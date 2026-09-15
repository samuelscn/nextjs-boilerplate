import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { catalogs } from "@/i18n/catalogs";
import { defaultLocale, resolveLocale, supportedLocales } from "@/i18n/config";
import { localizedError, localizedValidation, errorAction } from "@/i18n/errors";
import { ApiError, apiErrorSchema, errorDto, NetworkError, normalizeFrontendError, normalizeIdentityError, statusCodes } from "@/lib/http/api-error";
import { normalizeApiError } from "@/lib/http/normalize";
import { validCorrelationId, retryAfterMilliseconds } from "@/lib/http/correlation";
import { applyFieldErrors } from "@/lib/validation/form-errors";
import { validationDetails } from "@/lib/validation/details";
import { shouldRetryQuery } from "@/lib/query/client";
import { createProductClient } from "@/server/api/product";
import { errorResponse, requestId } from "@/server/http";
import { bffRequest } from "@/lib/http/browser";

const payload = (statusCode = 400, code = "VALIDATION_ERROR") => ({
  statusCode, code, message: "Internal SQL/password detail must never reach UI",
  timestamp: "2026-09-14T12:00:00.000Z", requestId: "req_01J_TEST",
});
describe("locale resolution and catalog integrity", () => {
  it("resolves URL, trusted preference, cookie, language and default in order", () => {
    expect(resolveLocale({ explicit: "en", preference: "pt-BR", cookie: "pt-BR" })).toBe("en");
    expect(resolveLocale({ preference: "en", cookie: "pt-BR" })).toBe("en");
    expect(resolveLocale({ cookie: "en", acceptLanguage: "pt-BR" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "fr;q=1,pt-BR;q=0.3,en-US;q=0.8" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "en;q=0,pt;q=0.5" })).toBe("pt-BR");
    expect(resolveLocale({ explicit: "../../secret", cookie: "unsupported", acceptLanguage: "fr" })).toBe(defaultLocale);
    expect(resolveLocale({ explicit: "unsupported", fallback: "en" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "en;q=not-a-number", fallback: "pt-BR" })).toBe("pt-BR");
  });
  it("keeps keys and namespaces consistent across locales", () => {
    const keys = (value: object, prefix = ""): string[] => Object.entries(value).flatMap(([key, entry]) => typeof entry === "string" ? [prefix + key] : keys(entry, prefix + key + ".")).sort();
    for (const locale of supportedLocales) expect(keys(catalogs[locale])).toEqual(keys(catalogs[defaultLocale]));
  });
});
describe("validated API error contract", () => {
  it("validates ISO timestamps, status, detail codes and bounded IDs", () => {
    expect(apiErrorSchema.safeParse({ ...payload(), details: [{ field: "email", code: "IS_EMAIL", message: "Email" }] }).success).toBe(true);
    for (const invalid of [{ timestamp: "yesterday" }, { timestamp: "2026-09-14T12:00:00" }, { statusCode: 200 }, { requestId: "x".repeat(129) }, { code: "../PRIVATE" }]) {
      expect(apiErrorSchema.safeParse({ ...payload(), ...invalid }).success).toBe(false);
    }
    expect(apiErrorSchema.safeParse({ ...payload(), timestamp: "2026-09-14T09:00:00-03:00" }).success).toBe(true);
  });
  it("normalizes malformed, inconsistent and oversized payloads without leaking text", async () => {
    for (const response of [
      new Response("<html>secret</html>", { status: 500 }),
      Response.json({ ...payload(400), statusCode: 200 }, { status: 400 }),
      Response.json(payload(403, "AUTHENTICATION_REQUIRED"), { status: 403 }),
      Response.json({ ...payload(500), message: "x".repeat(70_000) }, { status: 500 }),
    ]) {
      const error = await normalizeApiError(response);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).not.toContain("secret");
      expect(error.code).toBe(statusCodes[response.status]);
    }
  });
  it("preserves correlation from headers before payload and bounds untrusted input", async () => {
    const error = await normalizeApiError(Response.json(payload(), { status: 400, headers: { "x-correlation-id": "req_HEADER" } }));
    expect(error.requestId).toBe("req_HEADER");
    expect((await normalizeApiError(Response.json(payload(), { status: 400 }))).requestId).toBe("req_01J_TEST");
    expect(validCorrelationId("a\r\nb")).toBeUndefined();
    expect(validCorrelationId("x".repeat(129))).toBeUndefined();
    expect(requestId(new Request("https://app.test", { headers: { "x-correlation-id": "req_HEADER" } }))).toBe("req_HEADER");
    expect(requestId(new Request("https://app.test", { headers: { "x-correlation-id": "x".repeat(129) } }))).toMatch(/^[a-f0-9-]{36}$/u);
  });
  it("propagates correlation through Product API, BFF, DTO and logs", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload(409, "RESOURCE_CONFLICT"), { status: 409, headers: { "x-correlation-id": "req_UPSTREAM" } }));
    const client = createProductClient("https://api.test", async () => "private-access-token", transport);
    let failure: unknown;
    try { await client("/neutral", z.object({ ok: z.boolean() }), { requestId: "req_NEXT" }); } catch (error) { failure = error; }
    expect(transport.mock.calls[0]?.[1]?.headers).toMatchObject({ "x-correlation-id": "req_NEXT" });
    const response = errorResponse(failure, "req_NEXT");
    expect(response.headers.get("x-correlation-id")).toBe("req_UPSTREAM");
    expect(await response.json()).toMatchObject({ code: "RESOURCE_CONFLICT", requestId: "req_UPSTREAM" });
    expect(log.mock.calls.flat().join(" ")).toContain("req_UPSTREAM");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private-access-token");
    log.mockRestore();
  });
  it("strips internal messages/details from 500 and never serializes Error objects", () => {
    const dto = errorDto(new ApiError({ ...payload(500, "INTERNAL_SERVER_ERROR"), details: [{ field: "password", code: "INVALID_VALUE", message: "private-access-token" }] }));
    expect(dto.details).toBeUndefined();
    expect(dto.message).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(dto)).not.toContain("private-access-token");
    expect(apiErrorSchema.safeParse(errorDto(new Error("private-stack"), "req_A")).success).toBe(true);
    expect(normalizeFrontendError(new Error("secret")).kind).toBe("unexpected");
    expect(normalizeIdentityError({ code: "BETTER_AUTH_INTERNAL" }).code).toBe("IDENTITY_FLOW_INVALID");
    expect(normalizeIdentityError("unavailable").code).toBe("IDENTITY_UNAVAILABLE");
  });
  it("distinguishes network failures before the backend is reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed private URL")));
    try { await expect(bffRequest("/api/neutral", z.object({}))).rejects.toBeInstanceOf(NetworkError); }
    finally { vi.unstubAllGlobals(); }
  });
});
describe.each(supportedLocales)("localized error handling (%s)", locale => {
  const translator = createTranslator({ locale, messages: catalogs[locale] });
  type Key = Parameters<typeof translator>[0];
  const t = Object.assign((key: string) => translator(key as Key), { has: (key: string) => translator.has(key as Key) });
  it("translates all known codes, unknown codes by status and always hides 500 details", () => {
    for (const [status, code] of Object.entries(statusCodes)) expect(localizedError(new ApiError(payload(Number(status), code)), t)).toBe(t("errors." + code));
    expect(localizedError(new ApiError(payload(409, "NEW_DOMAIN_CODE")), t)).toBe(t("errors.RESOURCE_CONFLICT"));
    expect(localizedError(new ApiError(payload(500, "NEW_DOMAIN_CODE")), t)).toBe(t("errors.INTERNAL_SERVER_ERROR"));
    expect(localizedError(new NetworkError(), t)).toBe(t("errors.NETWORK_ERROR"));
    expect(localizedValidation("UNKNOWN_DETAIL", t)).toBe(t("validation.INVALID_VALUE"));
  });
  it("maps only known fields to RHF using codes, not backend phrases", () => {
    const setError = vi.fn();
    expect(applyFieldErrors<{ email: string }>([
      { field: "email", code: "IS_EMAIL", message: "Ignore me" },
      { field: "unknown", code: "IS_NOT_EMPTY", message: "Ignore me" },
      { field: "__proto__", code: "IS_NOT_EMPTY", message: "Ignore me" },
      { field: "email", code: "MAX_LENGTH", message: "Ignore duplicate" },
    ], ["email"], setError, t)).toBe(1);
    expect(setError).toHaveBeenCalledExactlyOnceWith("email", { type: "server", message: t("validation.IS_EMAIL") }, { shouldFocus: true });
    const result = z.object({ email: z.email() }).safeParse({ email: "invalid" });
    if (result.success) throw new Error("Expected invalid");
    expect(validationDetails(result.error)).toEqual([{ field: "email", code: "IS_EMAIL", message: "IS_EMAIL" }]);
  });
});
describe("status behavior and bounded retry", () => {
  it("distinguishes 401 login from 403 forbidden without a login loop", () => {
    expect(errorAction(new ApiError(payload(401, "AUTHENTICATION_REQUIRED")))).toBe("login");
    expect(errorAction(new ApiError(payload(403, "AUTHORIZATION_FORBIDDEN")))).toBe("forbidden");
  });
  it.each([400, 401, 403, 404, 409, 422, 429])("never blindly retries deterministic status %s", status => {
    expect(shouldRetryQuery(0, new ApiError(payload(status, statusCodes[status]!)))).toBe(false);
  });
  it("limits transient retries and keeps Retry-After for deliberate UX", async () => {
    const error = await normalizeApiError(Response.json(payload(429, "RATE_LIMIT_EXCEEDED"), { status: 429, headers: { "retry-after": "60" } }));
    expect(error.retryAfterMs).toBe(60_000);
    expect(errorResponse(error, "req_ID").headers.get("retry-after")).toBe("60");
    expect(shouldRetryQuery(0, error)).toBe(false);
    expect(shouldRetryQuery(0, new NetworkError())).toBe(true);
    expect(shouldRetryQuery(1, new NetworkError())).toBe(false);
    expect(shouldRetryQuery(0, new Error("programming bug"))).toBe(false);
    expect(retryAfterMilliseconds("Mon, 14 Sep 2026 12:01:00 GMT", Date.parse("2026-09-14T12:00:00Z"))).toBe(60_000);
    expect(retryAfterMilliseconds("invalid")).toBeUndefined();
  });
});
