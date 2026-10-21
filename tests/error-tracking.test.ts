import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn(), setTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({
  init: sentry.init,
  captureRequestError: sentry.captureRequestError,
  withScope: (callback: (scope: { setTag: typeof sentry.setTag }) => void) => callback({ setTag: sentry.setTag }),
}));
const { initErrorTracking, reportRequestError, scrubEvent } = await import("@/server/error-tracking");

afterEach(() => vi.clearAllMocks());

describe("server error tracking", () => {
  it("stays disabled without SENTRY_DSN", () => {
    expect(initErrorTracking({ NODE_ENV: "production" })).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("initializes errors-only with the Vercel commit as release", () => {
    expect(initErrorTracking({ NODE_ENV: "production", SENTRY_DSN: "https://k@o1.ingest.sentry.io/1", SENTRY_ENVIRONMENT: "homolog", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe(true);
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: "homolog", release: "abc", maxBreadcrumbs: 0 }));
    expect(sentry.init.mock.calls[0]![0]).not.toHaveProperty("tracesSampleRate");
  });

  it("drops headers, cookies, query, body, user and breadcrumbs", () => {
    const event = scrubEvent({
      type: undefined,
      request: { method: "GET", url: "https://app.example.com/backoffice?q=secret", headers: { cookie: "s" }, cookies: { s: "1" }, query_string: "q=secret", data: "x" },
      user: { id: "u" },
      breadcrumbs: [{ message: "m" }],
    });
    expect(event).toEqual({ type: undefined, request: { method: "GET", url: "https://app.example.com/backoffice" } } satisfies ErrorEvent);
  });

  it("reports with the request id and without the query string", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = new Error("boom");
    const context = { routerKind: "App Router", routePath: "/backoffice", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined } as const;
    await reportRequestError(error, { path: "/backoffice?q=secret", method: "GET", headers: { "x-request-id": "req-1", cookie: "s" } }, context);
    expect(sentry.setTag).toHaveBeenCalledWith("requestId", "req-1");
    expect(sentry.captureRequestError).toHaveBeenCalledWith(error, expect.objectContaining({ path: "/backoffice" }), context);
    expect(JSON.parse(info.mock.calls[0]![0] as string)).toMatchObject({ event: "server.error", requestId: "req-1" });
  });
});
