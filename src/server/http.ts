import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError, errorDto, PROBLEM_CONTENT_TYPE } from "@/lib/http/api-error";
import { HttpError } from "@/lib/http/error";
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
// Bounded urlencoded body for native POST forms (locale, theme), never unbounded request.formData().
export async function readSmallForm(request: Request, maxBytes = 4096): Promise<URLSearchParams> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") throw new HttpError(400, "VALIDATION_ERROR");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "VALIDATION_ERROR");
  let text = "";
  const decoder = new TextDecoder();
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new HttpError(400, "VALIDATION_ERROR");
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return new URLSearchParams(text);
}
