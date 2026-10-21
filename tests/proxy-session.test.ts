import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Renewal } from "@/server/auth/service";
import { authEnv } from "./helpers";

let renewal: Renewal = { kind: "unchanged" };
const renew = vi.fn(async () => renewal);
const applyRenewal = vi.fn((response: NextResponse, value: Renewal) => {
  if (value.kind === "renewed") response.cookies.set("__Host-ginga_session", value.value, { httpOnly: true, secure: true, path: "/" });
  if (value.kind === "ended") response.cookies.set("__Host-ginga_session", "", { maxAge: 0, path: "/" });
  return response;
});
vi.mock("@/config/env", () => ({ getEnv: () => authEnv() }));
vi.mock("@/server/auth", () => ({ authService: () => ({ sessionCookie: "__Host-ginga_session", renew, applyRenewal }) }));
const { proxy } = await import("@/proxy");
const request = (path: string) => new NextRequest("https://app.test" + path, { headers: { cookie: "__Host-ginga_session=old; theme=dark" } });

describe("proxy session renewal", () => {
  beforeEach(() => { renew.mockClear(); renewal = { kind: "unchanged" }; });
  it("renews before rendering and forwards the new cookie to the same render", async () => {
    renewal = { kind: "renewed", value: "new-sealed", maxAge: 3600 };
    const response = await proxy(request("/app/orders"));
    expect(renew).toHaveBeenCalledWith("old");
    expect(response.headers.get("x-middleware-request-cookie")).toBe("__Host-ginga_session=new-sealed; theme=dark");
    expect(response.headers.get("set-cookie")).toContain("__Host-ginga_session=new-sealed");
  });
  it("drops an ended session from the render and the browser", async () => {
    renewal = { kind: "ended" };
    const response = await proxy(request("/api/users"));
    expect(response.headers.get("x-middleware-request-cookie")).toBe("theme=dark");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it.each([
    ["prefetch", "/app", { "next-router-prefetch": "1" }],
    ["static file", "/logo.png", {}],
    ["cross-site navigation", "/app", { "sec-fetch-site": "cross-site" }],
  ])("does not renew on %s", async (_name, path, headers) => {
    renewal = { kind: "renewed", value: "new-sealed", maxAge: 3600 };
    await proxy(new NextRequest("https://app.test" + path, { headers: { cookie: "__Host-ginga_session=old", ...headers } }));
    expect(renew).not.toHaveBeenCalled();
  });
  it("leaves auth routes and fresh sessions untouched", async () => {
    await proxy(request("/auth/logout"));
    expect(renew).not.toHaveBeenCalled();
    const response = await proxy(request("/app"));
    expect(response.headers.get("x-middleware-request-cookie")).toBe("__Host-ginga_session=old; theme=dark");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
