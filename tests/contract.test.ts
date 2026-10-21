import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import openapi from "../contracts/openapi.json";
import fixtures from "../contracts/problem-fixtures.json";
import { catalogs } from "@/i18n/catalogs";
import { supportedLocales } from "@/i18n/config";
import { localizedError, localizedValidation } from "@/i18n/errors";
import { ApiError, statusCode } from "@/lib/http/api-error";
import { normalizeApiError } from "@/lib/http/normalize";

// Contract published by the Product API (npm run api:sync). If this fails after a sync,
// the API changed its error contract or published codes without frontend translations.
type Fixture = { response: { status: number; headers?: Record<string, string>; body: Record<string, unknown> } };
const cases = Object.entries((fixtures as unknown as { cases: Record<string, Fixture> }).cases);
const schemas = openapi.components.schemas as Record<string, { enum?: string[] }>;
const live = (body: Record<string, unknown>) => ({ ...body, traceId: "req_CONTRACT", timestamp: "2026-10-20T21:00:00.000Z" });

describe("Product API problem contract", () => {
  it.each(cases)("%s normalizes without losing code, params or field errors", async (_name, { response }) => {
    const error = await normalizeApiError(new Response(JSON.stringify(live(response.body)), {
      status: response.status, headers: { "Content-Type": "application/problem+json", "x-correlation-id": "req_CONTRACT", ...response.headers },
    }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(response.status);
    expect(error.code).toBe(response.body.code);
    expect(error.requestId).toBe("req_CONTRACT");
    expect(error.params).toEqual(response.body.params);
    expect(error.details).toEqual(response.body.errors);
    if (response.headers?.["Retry-After"]) expect(error.retryAfterMs).toBe(Number(response.headers["Retry-After"]) * 1000);
  });

  describe.each(supportedLocales)("translations (%s)", locale => {
    const translator = createTranslator({ locale, messages: catalogs[locale] });
    type Key = Parameters<typeof translator>[0];
    const t = Object.assign((key: string, values?: Record<string, string | number>) => translator(key as Key, values), { has: (key: string) => translator.has(key as Key) });

    it("covers every published problem and field code", () => {
      const missing = [
        ...schemas.ProblemCode!.enum!.filter(code => !t.has("errors." + code)).map(code => "errors." + code),
        ...schemas.FieldProblemCode!.enum!.filter(code => !t.has("validation." + code)).map(code => "validation." + code),
      ];
      expect(missing).toEqual([]);
    });
    it.each(cases)("%s renders a localized message, never wire text", async (_name, { response }) => {
      const error = await normalizeApiError(Response.json(live(response.body), { status: response.status }));
      const message = localizedError(error, t);
      const code = String(response.body.code);
      const expected = response.status >= 500 ? t("errors.INTERNAL_SERVER_ERROR")
        : t.has("errors." + code) ? t("errors." + code) : t("errors." + statusCode(response.status));
      expect(message).toBe(expected);
      if (typeof response.body.detail === "string") expect(message).not.toContain(response.body.detail);
      for (const detail of error.details ?? []) expect(localizedValidation(detail.code, t, detail.params)).toBeTruthy();
    });
  });

  it("interpolates params into ICU messages of specific codes", () => {
    const translator = createTranslator({ locale: "en", messages: { errors: { CATEGORY_FULL: "Limit of {maxParticipants} participants." } } });
    const t = Object.assign((key: string, values?: Record<string, string | number>) => translator(key as never, values as never), { has: (key: string) => translator.has(key as never) });
    expect(localizedError(new ApiError({ status: 422, code: "CATEGORY_FULL", params: { maxParticipants: 32 } }), t)).toBe("Limit of 32 participants.");
  });
});
