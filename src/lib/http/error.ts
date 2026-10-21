import { ApiError, statusCode } from "./api-error";

// Small adapter for internal HTTP failures. All consumers receive ApiError.
export class HttpError extends ApiError {
  constructor(status: number, code: string, requestId?: string) {
    const stableCode = /^[A-Z][A-Z0-9_]*$/u.test(code) ? code : statusCode(status);
    super({ status, code: stableCode, ...(requestId ? { traceId: requestId } : {}) });
  }
}
