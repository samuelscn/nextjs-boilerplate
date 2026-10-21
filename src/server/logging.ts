import "server-only";
import { validCorrelationId } from "@/lib/http/correlation";

// Allowlisted metadata only; never log payloads, messages, query strings or headers.
type Event = "auth.login" | "auth.callback_denied" | "auth.unavailable" | "session.expired" | "session.refresh_failed" | "session.too_large" | "auth.logout" | "auth.revocation_failed" | "api.failed";
export function log(event: Event, fields: { requestId?: string; status?: number; code?: string } = {}) {
  console.info(JSON.stringify({
    time: new Date().toISOString(), level: "info", event,
    ...(validCorrelationId(fields.requestId) ? { requestId: fields.requestId } : {}),
    ...(fields.status ? { statusCode: fields.status } : {}),
    ...(fields.code && /^[A-Z][A-Z0-9_]{0,95}$/u.test(fields.code) ? { code: fields.code } : {}),
  }));
}
