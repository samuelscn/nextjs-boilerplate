import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseEnv } from "@/config/schema";
import { proxy } from "@/proxy";
import { POST } from "@/app/api/locale/route";

let env = parseEnv({ APP_URL: "https://app.test" });
vi.mock("@/config/env", () => ({ getEnv: () => env }));
beforeEach(() => { env = parseEnv({ APP_URL: "https://app.test" }); });
describe("locale strategy and preference mutation", () => {
  it("redirects public URLs and forwards only validated locale with CSP intact", async () => {
    const response = await proxy(new NextRequest("https://app.test/", { headers: { "accept-language": "en-US", "x-ginga-locale": "../../secret" } }));
    expect(response.headers.get("location")).toBe("https://app.test/en");
    expect(response.headers.get("content-security-policy")).toContain("nonce-");
    const localized = await proxy(new NextRequest("https://app.test/pt-BR", { headers: { "accept-language": "en", "x-correlation-id": "req_A" } }));
    expect(localized.headers.get("x-middleware-rewrite")).toBe("https://app.test/");
    expect(localized.headers.get("x-middleware-request-x-ginga-locale")).toBe("pt-BR");
    expect(localized.headers.get("x-correlation-id")).toBe("req_A");
  });
  it("keeps API/auth paths out of locale rewrites and supports cookie-only public mode", async () => {
    for (const path of ["/api/health", "/auth/callback", "/en/api/health", "/en/auth/login"]) {
      const response = await proxy(new NextRequest("https://app.test" + path));
      expect(response.headers.has("x-middleware-rewrite")).toBe(false);
      expect(response.headers.has("location")).toBe(false);
    }
    env = parseEnv({ APP_URL: "https://app.test", I18N_URL_STRATEGY: "cookie", I18N_DEFAULT_LOCALE: "en" });
    const response = await proxy(new NextRequest("https://app.test/"));
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.get("content-language")).toBe("en");
  });
  const request = (body: string, origin = "https://app.test") => new Request("https://app.test/api/locale", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  it("sets a secure locale preference and rejects external return destinations", async () => {
    const response = await POST(request("locale=en&returnTo=https%3A%2F%2Fevil.test"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.test/en");
    expect(response.headers.get("set-cookie")).toContain("ginga_locale=en");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("rejects CSRF, unsupported/duplicate locale and oversized input", async () => {
    expect((await POST(request("locale=en", "https://evil.test"))).status).toBe(403);
    for (const body of ["locale=fr", "locale=en&locale=pt-BR", "locale=en&returnTo=" + "a".repeat(5000)]) {
      expect((await POST(request(body))).status).toBe(400);
    }
  });
  it("returns to passive auth pages after a language change, never auth actions", async () => {
    for (const path of ["/auth/error", "/auth/signed-out"]) {
      const response = await POST(request(new URLSearchParams({ locale: "en", returnTo: path }).toString()));
      expect(response.headers.get("location")).toBe("https://app.test" + path);
    }
    for (const path of ["/auth/login", "/auth/logout", "/auth/callback", "/auth/error/../login", "/api/session", "//evil.test"]) {
      const response = await POST(request(new URLSearchParams({ locale: "en", returnTo: path }).toString()));
      expect(response.headers.get("location")).toBe("https://app.test/en");
    }
  });
});
