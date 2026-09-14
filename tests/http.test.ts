import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createProductClient } from "@/server/api/product";
import { createBffHandler } from "@/server/api/route";
import { readJson } from "@/lib/http/json";
import { bffRequest } from "@/lib/http/browser";
import { assertSameOrigin } from "@/server/security/csrf";
import { authEnv } from "./helpers";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const schema = z.object({ label: z.string() });
describe("HTTP and BFF security", () => {
  it("validates JSON and strips fields outside the public schema", async () => {
    expect(await readJson(Response.json({ label: "ok", refresh_token: "never-serialize" }), schema)).toEqual({ label: "ok" });
    await expect(readJson(Response.json({ other: 1 }), schema)).rejects.toMatchObject({ status: 502 });
    await expect(readJson(new Response("<html>upstream secret", { status: 500 }), schema)).rejects.toMatchObject({ status: 500, message: "request_failed" });
    await expect(readJson(Response.json({ label: "too long" }), schema, 2)).rejects.toMatchObject({ code: "response_too_large" });
  });
  it("sets server-only Bearer, no-store and redirect:error; does not forward cookies", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ label: "ok", access_token: "secret", refresh_token: "secret" }, { headers: { "Set-Cookie": "upstream=secret" } }));
    const api = createProductClient("https://api.test/base", async () => "access-secret", transport);
    const response = await api("/status", schema, { requestId: "test-id" });
    expect(response).toEqual({ label: "ok" });
    expect(transport.mock.calls[0]?.[0].toString()).toBe("https://api.test/base/status");
    expect(transport.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", redirect: "error", headers: { Authorization: "Bearer access-secret" } });
    expect(transport.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Cookie");
  });
  it.each(["https://evil.test", "//evil.test", "/../private", "/%2fprivate"])("rejects host/path injection before any request: %s", async path => {
    const transport = vi.fn<typeof fetch>();
    await expect(createProductClient("https://api.test", async () => "secret", transport)(path, schema, { requestId: "id" })).rejects.toMatchObject({ status: 400 });
    expect(transport).not.toHaveBeenCalled();
  });
  it("blocks accidental access token reflection and normalizes upstream failure", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ label: "access-secret" }));
    const api = createProductClient("https://api.test", async () => "access-secret", transport);
    await expect(api("/status", schema, { requestId: "id" })).rejects.toMatchObject({ status: 502 });
    transport.mockRejectedValue(new Error("internal server details"));
    await expect(api("/status", schema, { requestId: "id" })).rejects.toMatchObject({ message: "product_api_unavailable" });
  });
  it("invalidates session after an upstream 401", async () => {
    const invalidate = vi.fn();
    const api = createProductClient("https://api.test", async () => "token", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })), invalidate);
    await expect(api("/status", schema, { requestId: "id" })).rejects.toMatchObject({ status: 401 });
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it("browser client rejects external URLs and uses same-origin credentials", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ label: "ok" }));
    vi.stubGlobal("fetch", transport);
    try {
      await expect(bffRequest("https://api.test", schema)).rejects.toMatchObject({ status: 400 });
      expect(await bffRequest("/api/status", schema)).toEqual({ label: "ok" });
      expect(transport.mock.calls[0]?.[1]).toMatchObject({ credentials: "same-origin", cache: "no-store", redirect: "error" });
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([undefined, "https://evil.test", "null"])("rejects CSRF origin %s", origin => {
    const request = new Request("https://app.test/api/example", { method: "POST", headers: origin ? { origin } : {} });
    expect(() => assertSameOrigin(request, "https://app.test")).toThrow();
  });
  it("checks auth, origin, body and output at a named BFF route", async () => {
    const execute = vi.fn(async () => ({ label: "ok" }));
    const dependencies = { getEnv: () => authEnv(), getSession: vi.fn(async () => ({ user: { id: "subject" }, expiresAt: Date.now() + 60_000 })) };
    const handler = createBffHandler({ method: "POST", input: schema, output: schema, execute }, dependencies);
    const req = (body: string, origin = "https://app.test") => new Request("https://app.test/api/example", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body });
    expect((await handler(req('{"label":"valid"}'))).status).toBe(200);
    expect((await handler(req('{"other":1}'))).status).toBe(400);
    expect((await handler(req('{"label":"valid"}', "https://evil.test"))).status).toBe(403);
    dependencies.getSession.mockResolvedValueOnce(null as never);
    expect((await handler(req('{"label":"valid"}'))).status).toBe(401);
    expect(execute).toHaveBeenCalledOnce();
  });
});
