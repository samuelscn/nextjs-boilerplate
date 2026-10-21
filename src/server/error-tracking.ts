import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { correlationId } from "@/lib/http/correlation";
import type { Environment } from "@/config/schema";
import { log } from "./logging";

// Errors-only Sentry on the server, enabled by SENTRY_DSN. No tracing, breadcrumbs, headers,
// cookies, query, body or user: events carry the stack, the route and the request id.
export function initErrorTracking(env: Pick<Environment, "SENTRY_DSN" | "SENTRY_ENVIRONMENT" | "SENTRY_RELEASE" | "VERCEL_GIT_COMMIT_SHA" | "NODE_ENV">) {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA,
    // SDK 11 collects these by default; scrubEvent is the second layer.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  return true;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const { method, url } = event.request;
    event.request = { ...(method ? { method } : {}), ...(url ? { url: url.split("?")[0]! } : {}) };
  }
  delete event.user;
  delete event.breadcrumbs;
  return event;
}

// Next calls this for every uncaught server error (render, route handler, server action, proxy).
export const reportRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(name, value);
  const requestId = correlationId(headers);
  log("server.error", requestId ? { requestId } : {});
  Sentry.withScope(scope => {
    if (requestId) scope.setTag("requestId", requestId);
    Sentry.captureRequestError(error, { ...request, path: request.path.split("?")[0]! }, context);
  });
};
