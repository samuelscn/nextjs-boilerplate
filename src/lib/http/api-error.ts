import { z } from "zod";
import { validCorrelationId } from "./correlation";

export const statusCodes: Record<number, string> = {
  400: "VALIDATION_ERROR", 401: "AUTHENTICATION_REQUIRED", 403: "AUTHORIZATION_FORBIDDEN",
  404: "RESOURCE_NOT_FOUND", 409: "RESOURCE_CONFLICT", 422: "DOMAIN_RULE_VIOLATION",
  429: "RATE_LIMIT_EXCEEDED", 500: "INTERNAL_SERVER_ERROR",
};
export const statusCode = (status: number) => statusCodes[status] ?? "INTERNAL_SERVER_ERROR";
export const errorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,95}$/u);
export const apiErrorDetailSchema = z.object({
  field: z.string().max(128).optional(), code: errorCodeSchema, message: z.string().max(2048),
});
export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599), code: errorCodeSchema, message: z.string().max(4096),
  details: z.array(apiErrorDetailSchema).max(100).optional(),
  requestId: z.string().max(128).refine(value => Boolean(validCorrelationId(value))).optional(),
  timestamp: z.iso.datetime({ offset: true }),
  path: z.string().max(2048).optional(),
});
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export class ApiError extends Error {
  readonly kind = "api";
  readonly statusCode: number;
  readonly code: string;
  readonly details: ApiErrorDetail[] | undefined;
  readonly requestId: string | undefined;
  readonly timestamp: string;
  readonly path: string | undefined;
  constructor(payload: ApiErrorResponse, public readonly retryAfterMs?: number) {
    // Error.message is deliberately safe; wire message is never a UI contract.
    super(payload.code);
    this.name = "ApiError";
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.details = payload.details;
    this.requestId = payload.requestId;
    this.timestamp = payload.timestamp;
    this.path = payload.path;
  }
  get status() { return this.statusCode; }
}

export class NetworkError extends Error {
  readonly kind = "network";
  readonly code = "NETWORK_ERROR";
  constructor(public readonly requestId?: string) { super("NETWORK_ERROR"); this.name = "NetworkError"; }
}
export class UnexpectedError extends Error {
  readonly kind = "unexpected";
  readonly code = "INTERNAL_SERVER_ERROR";
  constructor(public readonly requestId?: string) { super("INTERNAL_SERVER_ERROR"); this.name = "UnexpectedError"; }
}
export class IdentityError extends Error {
  readonly kind = "identity";
  constructor(public readonly code: "IDENTITY_UNAVAILABLE" | "IDENTITY_FLOW_INVALID", public readonly requestId?: string) {
    super(code); this.name = "IdentityError";
  }
}
// OAuth/Better Auth payloads are not Product API payloads. Only our boundary reason is exposed.
export function normalizeIdentityError(reason: unknown): IdentityError {
  return new IdentityError(reason === "unavailable" ? "IDENTITY_UNAVAILABLE" : "IDENTITY_FLOW_INVALID");
}
export function normalizeFrontendError(error: unknown) {
  return error instanceof ApiError || error instanceof NetworkError || error instanceof IdentityError || error instanceof UnexpectedError ? error : new UnexpectedError();
}
// Route Handlers and Server Actions return this DTO, never an Error instance.
export function errorDto(error: unknown, fallbackId?: string): ApiErrorResponse {
  const normalized = normalizeFrontendError(error);
  const status = normalized instanceof ApiError ? normalized.statusCode : normalized instanceof NetworkError ? 503 : 500;
  const code = status >= 500 && !(normalized instanceof NetworkError) ? "INTERNAL_SERVER_ERROR" : normalized.code;
  const id = validCorrelationId(normalized.requestId) ?? validCorrelationId(fallbackId);
  return {
    statusCode: status, code, message: code, timestamp: new Date().toISOString(),
    ...(id ? { requestId: id } : {}),
    ...(normalized instanceof ApiError && status < 500 && normalized.details ? {
      details: normalized.details.map(detail => ({ ...(detail.field ? { field: detail.field } : {}), code: detail.code, message: detail.code })),
    } : {}),
  };
}
