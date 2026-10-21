import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "./config/env";
import { securityHeaders } from "./lib/security/headers";
import { correlationId } from "./lib/http/correlation";
import { isPublicPagePath, localeCookie, localizedPath, publicPrefix, resolveLocale, stripLocale } from "./i18n/config";
import { authService } from "./server/auth";
import { shouldRenew, type Renewal } from "./server/auth/service";

export async function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString("base64");
  const env = getEnv();
  const headers = securityHeaders(nonce, env.NODE_ENV === "production", env.APP_KIND === "public" ? undefined : new URL(env.OIDC_ISSUER).origin);
  const forwarded = new Headers(request.headers);
  const id = correlationId(request.headers) ?? randomUUID();
  const original = request.nextUrl.pathname;
  const stripped = stripLocale(original);
  const prefix = publicPrefix(env) && isPublicPagePath(stripped.path);
  const locale = resolveLocale({
    explicit: prefix ? stripped.locale : undefined,
    cookie: request.cookies.get(localeCookie)?.value,
    acceptLanguage: request.headers.get("accept-language"), fallback: env.I18N_DEFAULT_LOCALE,
  });
  // Never trust caller-provided locale/path/CSP headers.
  forwarded.set("x-ginga-locale", locale);
  forwarded.set("x-ginga-path", original);
  forwarded.set("x-correlation-id", id);
  forwarded.set("x-request-id", id);
  forwarded.set("x-nonce", nonce);
  forwarded.set("Content-Security-Policy", headers["Content-Security-Policy"]!);
  // Renew the sealed session before rendering: only here (and route handlers) can a refreshed cookie be written.
  // The forwarded request carries the new cookie so this same render already reads the renewed session.
  let renewal: Renewal = { kind: "unchanged" };
  if (env.APP_KIND !== "public" && shouldRenew(request, stripped.path)) {
    const auth = authService();
    renewal = await auth.renew(request.cookies.get(auth.sessionCookie)?.value);
    if (renewal.kind === "renewed") request.cookies.set(auth.sessionCookie, renewal.value);
    if (renewal.kind === "ended") request.cookies.delete(auth.sessionCookie);
    if (renewal.kind !== "unchanged") forwarded.set("cookie", request.headers.get("cookie") ?? "");
  }
  let response: NextResponse;
  if (prefix && !stripped.locale) {
    const destination = new URL(env.APP_URL);
    destination.pathname = localizedPath(original, locale);
    destination.search = request.nextUrl.search;
    response = NextResponse.redirect(destination, 307);
  } else if (prefix && stripped.locale) {
    const destination = request.nextUrl.clone();
    destination.pathname = stripped.path;
    response = NextResponse.rewrite(destination, { request: { headers: forwarded } });
  } else response = NextResponse.next({ request: { headers: forwarded } });
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  response.headers.set("x-correlation-id", id);
  response.headers.set("x-request-id", id);
  response.headers.set("Content-Language", locale);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Accept-Language, Cookie");
  return env.APP_KIND === "public" ? response : authService().applyRenewal(response, renewal);
}
export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
