import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createProductClient } from "@/server/api/product";
import { createBffHandler } from "@/server/api/route";
import { HttpError } from "@/lib/http/error";
import { readJson } from "@/lib/http/json";
import { bffRequest } from "@/lib/http/browser";
import { assertSameOrigin } from "@/server/security/csrf";
import { securityHeaders } from "@/lib/security/headers";
import { authEnv } from "./helpers";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const schema = z.object({ label: z.string() });
describe("HTTP and BFF security", () => {
  it("preserves same-origin form origins without sending external referrers", () => {
    expect(securityHeaders("test-nonce", true)["Referrer-Policy"]).toBe("same-origin");
    expect(securityHeaders("test-nonce", false)["Referrer-Policy"]).toBe("same-origin");
  });
  it.each(["same-site", "cross-site"])("rejects %s mutations even with a matching origin", site => {
    const request = new Request("https://app.test/api/example", {
      method: "POST", headers: { origin: "https://app.test", "sec-fetch-site": site },
    });
    expect(() => assertSameOrigin(request, "https://app.test")).toThrow();
  });
  it("accepts same-origin POSTs through an internal HTTP ingress", () => {
    const request = new Request("http://127.0.0.1:3400/api/example", {
      method: "POST", headers: { origin: "https://app.test", "sec-fetch-site": "same-origin" },
    });
    expect(() => assertSameOrigin(request, "https://app.test")).not.toThrow();
  });
  it("validates JSON and strips fields outside the public schema", async () => {
    expect(await readJson(Response.json({ label: "ok", refresh_token: "never-serialize" }), schema)).toEqual({ label: "ok" });
    await expect(readJson(Response.json({ other: 1 }), schema)).rejects.toMatchObject({ status: 502 });
    await expect(readJson(new Response("<html>upstream secret", { status: 500 }), schema)).rejects.toMatchObject({ status: 500, code: "INTERNAL_SERVER_ERROR" });
    await expect(readJson(Response.json({ label: "too long" }), schema, 2)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
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
    await expect(api("/status", schema, { requestId: "id" })).rejects.toMatchObject({ kind: "network", code: "NETWORK_ERROR" });
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
  it("answers 404 for operations behind a disabled flag, before any other check", async () => {
    const execute = vi.fn(async () => ({ label: "ok" }));
    const dependencies = { getEnv: () => authEnv(), getSession: vi.fn(async () => null), isEnabled: vi.fn(async () => false) };
    const handler = createBffHandler({ method: "POST", flag: "rolesEditor", input: schema, output: schema, execute }, dependencies);
    const response = await handler(new Request("https://app.test/api/example", { method: "POST", headers: { origin: "https://app.test", "Content-Type": "application/json" }, body: '{"label":"valid"}' }));
    expect(response.status).toBe(404);
    expect(dependencies.getSession).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
  it("re-checks the route permission before executing", async () => {
    const execute = vi.fn(async () => ({ label: "ok" }));
    const assertPermission = vi.fn(async () => { throw new HttpError(403, "AUTHORIZATION_FORBIDDEN"); });
    const dependencies = { getEnv: () => authEnv(), getSession: vi.fn(async () => ({ user: { id: "subject" }, expiresAt: Date.now() + 60_000 })), assertPermission };
    const handler = createBffHandler({ method: "POST", permission: "member:invite", input: schema, output: schema, execute }, dependencies);
    const response = await handler(new Request("https://app.test/api/example", { method: "POST", headers: { origin: "https://app.test", "Content-Type": "application/json" }, body: '{"label":"valid"}' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "AUTHORIZATION_FORBIDDEN" });
    expect(assertPermission).toHaveBeenCalledWith("member:invite");
    expect(execute).not.toHaveBeenCalled();
  });
});
