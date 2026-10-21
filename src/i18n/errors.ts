import { ApiError, IdentityError, NetworkError, normalizeFrontendError, statusCode } from "@/lib/http/api-error";
import type { ProblemParams } from "@/lib/http/api-error";
export type Translate = { (key: string, values?: Record<string, string | number>): string; has(key: string): boolean };
// ICU accepts strings/numbers; booleans become "true"/"false" for `select` arguments.
const icu = (params?: ProblemParams) => params && Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === "boolean" ? String(value) : value]));
export function localizedError(error: unknown, t: Translate): string {
  const normalized = normalizeFrontendError(error);
  if (normalized instanceof NetworkError || normalized.code === "NETWORK_ERROR") return t("errors.NETWORK_ERROR");
  if (normalized instanceof IdentityError) return t("errors." + normalized.code);
  const status = normalized instanceof ApiError ? normalized.statusCode : 500;
  // 5xx always hide technical/domain messages, even if a code has a translation.
  if (status >= 500) return t("errors.INTERNAL_SERVER_ERROR");
  const key = "errors." + normalized.code;
  // Params feed ICU placeholders of known codes only (e.g. {max}); generic fallbacks take none.
  return t.has(key) ? t(key, icu(normalized instanceof ApiError ? normalized.params : undefined)) : t("errors." + statusCode(status));
}
export function localizedValidation(code: string, t: Translate, params?: ProblemParams): string {
  const key = "validation." + code;
  return t.has(key) ? t(key, icu(params)) : t("validation.INVALID_VALUE");
}
export function errorAction(error: unknown): "login" | "forbidden" | "display" {
  if (!(error instanceof ApiError)) return "display";
  if (error.code === "AUTHENTICATION_REQUIRED" || error.statusCode === 401) return "login";
  if (error.code === "AUTHORIZATION_FORBIDDEN" || error.statusCode === 403) return "forbidden";
  return "display";
}
