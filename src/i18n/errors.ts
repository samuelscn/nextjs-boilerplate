import { ApiError, IdentityError, NetworkError, normalizeFrontendError, statusCode } from "@/lib/http/api-error";
export type Translate = { (key: string): string; has(key: string): boolean };
export function localizedError(error: unknown, t: Translate): string {
  const normalized = normalizeFrontendError(error);
  if (normalized instanceof NetworkError || normalized.code === "NETWORK_ERROR") return t("errors.NETWORK_ERROR");
  if (normalized instanceof IdentityError) return t("errors." + normalized.code);
  const status = normalized instanceof ApiError ? normalized.statusCode : 500;
  // 5xx always hide technical/domain messages, even if a code has a translation.
  if (status >= 500) return t("errors.INTERNAL_SERVER_ERROR");
  const key = "errors." + normalized.code;
  return t(t.has(key) ? key : "errors." + statusCode(status));
}
export function localizedValidation(code: string, t: Translate): string {
  const key = "validation." + code;
  return t(t.has(key) ? key : "validation.INVALID_VALUE");
}
export function errorAction(error: unknown): "login" | "forbidden" | "display" {
  if (!(error instanceof ApiError)) return "display";
  if (error.code === "AUTHENTICATION_REQUIRED" || error.statusCode === 401) return "login";
  if (error.code === "AUTHORIZATION_FORBIDDEN" || error.statusCode === 403) return "forbidden";
  return "display";
}
