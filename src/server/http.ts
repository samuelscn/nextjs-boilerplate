import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http/error";

export function requestId(request: Request): string {
  const value = request.headers.get("x-request-id");
  return value && /^[a-f0-9-]{36}$/iu.test(value) ? value : randomUUID();
}
export function privateJson(data: unknown, status = 200, id: string = randomUUID()) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "x-request-id": id } });
}
export function errorResponse(error: unknown, id: string) {
  const status = error instanceof HttpError ? error.status : 500;
  return privateJson({ error: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 404 ? "not_found" : "request_failed", requestId: id }, status, id);
}
