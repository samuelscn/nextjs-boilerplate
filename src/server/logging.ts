import "server-only";

// Allowlisted events/fields instead of attempting to redact arbitrary objects.
type Event = "auth.login" | "auth.callback_denied" | "auth.unavailable" | "session.expired" | "session.refresh_failed" | "auth.logout" | "auth.revocation_failed" | "api.failed";
export function log(event: Event, fields: { requestId?: string; status?: number } = {}) {
  console.info(JSON.stringify({
    time: new Date().toISOString(), level: "info", event,
    ...(fields.requestId && /^[a-f0-9-]{36}$/iu.test(fields.requestId) ? { requestId: fields.requestId } : {}),
    ...(fields.status ? { status: fields.status } : {}),
  }));
}
