import { z } from "zod";
import { validCorrelationId } from "./correlation";

// Wire contract: RFC 9457 Problem Details + Ginga extensions (code, params, errors, traceId),
// published by the Product API in contracts/openapi.json. Decide and translate by `code`;
// `title`/`detail` are developer-facing and never rendered.
export const PROBLEM_CONTENT_TYPE = "application/problem+json";
export const statusCodes: Record<number, string> = {
  400: "VALIDATION_ERROR", 401: "AUTHENTICATION_REQUIRED", 403: "AUTHORIZATION_FORBIDDEN",
  404: "RESOURCE_NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 409: "RESOURCE_CONFLICT", 413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE", 422: "DOMAIN_RULE_VIOLATION", 429: "RATE_LIMIT_EXCEEDED",
  500: "INTERNAL_SERVER_ERROR", 503: "SERVICE_UNAVAILABLE",
};
export const statusCode = (status: number) => statusCodes[status] ?? "INTERNAL_SERVER_ERROR";
export const errorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,95}$/u);
// ICU values only: bounded primitives, never objects that could smuggle markup or secrets.
export const problemParamsSchema = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/u), z.union([z.string().max(256), z.number(), z.boolean()]))
  .refine(params => Object.keys(params).length <= 20);
export const apiErrorDetailSchema = z.object({
  field: z.string().max(128).optional(), code: errorCodeSchema, params: problemParamsSchema.optional(),
});
export const problemSchema = z.object({
  type: z.string().max(2048).optional(),
  title: z.string().max(256).optional(),
  status: z.number().int().min(400).max(599),
  detail: z.string().max(4096).optional(),
  instance: z.string().max(2048).optional(),
  code: errorCodeSchema,
  params: problemParamsSchema.optional(),
  errors: z.array(apiErrorDetailSchema).max(100).optional(),
  traceId: z.string().max(128).refine(value => Boolean(validCorrelationId(value))).optional(),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ProblemParams = z.infer<typeof problemParamsSchema>;
export type Problem = z.infer<typeof problemSchema>;
export type ProblemInput = Pick<Problem, "status" | "code"> & Partial<Pick<Problem, "params" | "errors" | "traceId" | "timestamp" | "instance">>;

export const problemType = (code: string) => "urn:ginga:problem:" + code.toLowerCase().replaceAll("_", "-");
export const problemTitle = (code: string) => code.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export class ApiError extends Error {
  readonly kind = "api";
  readonly statusCode: number;
  readonly code: string;
  readonly params: ProblemParams | undefined;
  readonly details: ApiErrorDetail[] | undefined;
  readonly requestId: string | undefined;
  readonly timestamp: string;
  readonly path: string | undefined;
  constructor(problem: ProblemInput, public readonly retryAfterMs?: number) {
    // Error.message is deliberately the code; wire title/detail are never a UI contract.
    super(problem.code);
    this.name = "ApiError";
    this.statusCode = problem.status;
    this.code = problem.code;
    this.params = problem.params;
    this.details = problem.errors;
    this.requestId = problem.traceId;
    this.timestamp = problem.timestamp ?? new Date().toISOString();
    this.path = problem.instance;
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
// Route Handlers and Server Actions answer the browser with this Problem, never an Error instance.
// Allowlisted fields only; 5xx hides params/errors and network failures become 503.
export function errorDto(error: unknown, fallbackId?: string): Problem & { traceId?: string; timestamp: string } {
  const normalized = normalizeFrontendError(error);
  const status = normalized instanceof ApiError ? normalized.statusCode : normalized instanceof NetworkError ? 503 : 500;
  const code = status >= 500 && !(normalized instanceof NetworkError) ? "INTERNAL_SERVER_ERROR" : normalized.code;
  const id = validCorrelationId(normalized.requestId) ?? validCorrelationId(fallbackId);
  const exposed = normalized instanceof ApiError && status < 500;
  return {
    type: problemType(code), title: problemTitle(code), status, code,
    ...(exposed && normalized.params ? { params: normalized.params } : {}),
    ...(exposed && normalized.details ? {
      errors: normalized.details.map(detail => ({ ...(detail.field ? { field: detail.field } : {}), code: detail.code, ...(detail.params ? { params: detail.params } : {}) })),
    } : {}),
    ...(id ? { traceId: id } : {}),
    timestamp: new Date().toISOString(),
  };
}
