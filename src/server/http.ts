import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError, errorDto, PROBLEM_CONTENT_TYPE } from "@/lib/http/api-error";
import { correlationId, validCorrelationId } from "@/lib/http/correlation";

export function requestId(request: Request): string {
  return correlationId(request.headers) ?? randomUUID();
}
export function privateJson(data: unknown, status = 200, id: string = randomUUID()) {
  const safeId = validCorrelationId(id) ?? randomUUID();
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "x-correlation-id": safeId, "x-request-id": safeId } });
}
export function errorResponse(error: unknown, id: string) {
  const dto = errorDto(error, id);
  const response = privateJson(dto, dto.status, dto.traceId ?? id);
  response.headers.set("Content-Type", PROBLEM_CONTENT_TYPE);
  if (error instanceof ApiError && error.retryAfterMs !== undefined) response.headers.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));
  return response;
}
