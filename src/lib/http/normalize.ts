import { ApiError, problemSchema, statusCode, statusCodes } from "./api-error";
import { correlationId, retryAfterMilliseconds, validCorrelationId } from "./correlation";
import { readBodyJson } from "./body";

export async function normalizeApiError(response: Response, fallbackId?: string): Promise<ApiError> {
  const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
  const headerId = correlationId(response.headers) ?? validCorrelationId(fallbackId);
  const retryAfter = retryAfterMilliseconds(response.headers.get("retry-after"));
  let input: unknown;
  try { input = await readBodyJson(response, 65_536); } catch { /* Fail closed for malformed/oversized payloads. */ }
  const parsed = problemSchema.safeParse(input);
  // A generic code must agree with the HTTP status; specific domain codes are free.
  if (parsed.success && parsed.data.status === status &&
      !Object.entries(statusCodes).some(([expected, code]) => code === parsed.data.code && Number(expected) !== status)) {
    return new ApiError({ ...parsed.data, ...(headerId ? { traceId: headerId } : {}) }, retryAfter);
  }
  return new ApiError({ status, code: statusCode(status), ...(headerId ? { traceId: headerId } : {}) }, retryAfter);
}
