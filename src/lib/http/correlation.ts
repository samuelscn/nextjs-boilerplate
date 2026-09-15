export function validCorrelationId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(value) ? value : undefined;
}
export function correlationId(headers: Headers): string | undefined {
  return validCorrelationId(headers.get("x-correlation-id")) ?? validCorrelationId(headers.get("x-request-id"));
}
export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value || value.length > 64) return undefined;
  const delay = /^\d+$/u.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isSafeInteger(delay) && delay >= 0 ? delay : undefined;
}
