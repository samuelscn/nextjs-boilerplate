import "server-only";
import * as oidc from "openid-client";
import { NextRequest, NextResponse } from "next/server";
import type { AuthEnvironment } from "@/config/schema";
import { HttpError } from "@/lib/http/error";
import { internalReturnPath } from "@/lib/validation/urls";
import { assertSameOrigin } from "../security/csrf";
import { errorResponse, requestId } from "../http";
import { log } from "../logging";
import { seal, unseal, type SealKey } from "../session/seal";
import { sessionSchema, transactionSchema, type SessionRecord, type Tokens } from "../session/records";
import type { IdentityClient } from "./oidc";

export type PublicSession = { user: { id: string }; expiresAt: number };
// Outcome of the refresh done by the proxy (or /auth/refresh) before rendering: Server Components cannot write cookies.
export type Renewal = { kind: "unchanged" } | { kind: "renewed"; value: string; maxAge: number } | { kind: "ended" };

// The proxy renews this long before expiry, so a render that started after it never sees an expired token.
const RENEW_MARGIN = 60_000;
// Below this a Server Component treats the session as stale and sends the user through /auth/refresh.
const STALE_MARGIN = 30_000;
// One cookie (~4 KB browser limit) with room for name and attributes.
const MAX_COOKIE = 3800;

// Renewal only for requests whose response the browser will keep: never prefetches (often aborted or discarded),
// static files, or navigations started by another site.
export const crossSite = (request: NextRequest) => request.headers.get("sec-fetch-site") === "cross-site";
export function shouldRenew(request: NextRequest, path: string) {
  const prefetch = request.headers.has("next-router-prefetch") || /prefetch/iu.test(request.headers.get("purpose") ?? request.headers.get("sec-purpose") ?? "");
  return !path.startsWith("/auth/") && !/\.[a-z0-9]+$/iu.test(path) && !prefetch && !crossSite(request);
}

export function createAuthService(env: AuthEnvironment, keys: SealKey[], identity: IdentityClient, now: () => number = Date.now) {
  const secure = env.NODE_ENV === "production" || env.APP_URL.startsWith("https:");
  const sessionCookie = secure ? "__Host-ginga_session" : "ginga_session";
  const transactionCookie = secure ? "__Host-ginga_transaction" : "ginga_transaction";
  const attributes = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  const home = env.APP_KIND === "backoffice" ? "/backoffice" : "/app";
  const privateRedirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, env.APP_URL), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const read = (value: string | undefined, options?: { ignoreExpiry?: boolean }) => unseal(value, keys, sessionSchema, now(), options);
  const maxAge = (record: SessionRecord) => Math.max(0, Math.floor((record.expiresAt - now()) / 1000));
  async function sealSession(tokens: Tokens, expiresAt: number) {
    const value = await seal({ v: 1, ...tokens, expiresAt }, keys, expiresAt, now());
    if (value.length > MAX_COOKIE) { log("session.too_large"); throw new Error("Session too large"); }
    return value;
  }
  // Concurrent requests of one instance carrying the same cookie share a single refresh; across instances the
  // Identity's reuse window replays the same response. Entries live only while the refresh is in flight.
  const inflight = new Map<string, Promise<Renewal>>();
  function renew(value: string | undefined): Promise<Renewal> {
    if (!value) return Promise.resolve({ kind: "unchanged" });
    const pending = inflight.get(value);
    if (pending) return pending;
    const renewal = renewOnce(value).finally(() => inflight.delete(value));
    inflight.set(value, renewal);
    return renewal;
  }
  async function renewOnce(value: string): Promise<Renewal> {
    const record = await read(value);
    if (!record) return { kind: "ended" };
    if (record.accessExpiresAt > now() + RENEW_MARGIN) return { kind: "unchanged" };
    if (!record.refreshToken) return { kind: "ended" };
    try {
      // Parallel instances may present the same refresh token: the Identity replays the same response
      // inside its reuse window (refreshTokenReuseInterval), so no shared lock is needed here.
      const tokens = await identity.refresh(record.refreshToken, record.subject);
      if (tokens.subject !== record.subject || tokens.accessExpiresAt <= now() + STALE_MARGIN) throw new Error("Invalid refresh");
      const next = await sealSession(tokens, record.expiresAt);
      return { kind: "renewed", value: next, maxAge: maxAge(record) };
    } catch {
      log("session.refresh_failed");
      return { kind: "ended" };
    }
  }
  function applyRenewal(response: NextResponse, renewal: Renewal) {
    if (renewal.kind === "renewed") response.cookies.set(sessionCookie, renewal.value, { ...attributes, maxAge: renewal.maxAge });
    if (renewal.kind === "ended") response.cookies.set(sessionCookie, "", { ...attributes, maxAge: 0 });
    return response;
  }
  return {
    sessionCookie,
    renew,
    applyRenewal,
    // Read-only: never refreshes, because a refreshed token could not be persisted from a Server Component.
    async getSession(value: string | undefined): Promise<(PublicSession & { stale: boolean }) | null> {
      const record = await read(value);
      if (!record) return null;
      const stale = record.accessExpiresAt <= now() + STALE_MARGIN;
      if (stale && !record.refreshToken) return null;
      return { user: { id: record.subject }, expiresAt: record.expiresAt, stale };
    },
    async accessToken(value: string | undefined): Promise<string> {
      const record = await read(value);
      if (!record || record.accessExpiresAt <= now() + 5_000) throw new HttpError(401, "unauthorized");
      return record.accessToken;
    },
    async login(request: NextRequest) {
      const id = requestId(request);
      try {
        if (request.headers.get("purpose") === "prefetch" || request.headers.has("next-router-prefetch")) return new Response(null, { status: 204 });
        const transaction = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(),
          returnTo: internalReturnPath(request.nextUrl.searchParams.get("returnTo"), home) };
        const destination = await identity.authorization(transaction);
        const sealed = await seal({ v: 1, ...transaction }, keys, now() + 600_000, now());
        const response = privateRedirect(destination.href);
        response.cookies.set(transactionCookie, sealed, { ...attributes, maxAge: 600 });
        log("auth.login", { requestId: id });
        return response;
      } catch (error) {
        log("auth.unavailable", { requestId: id });
        if (error instanceof HttpError) return errorResponse(error, id);
        return privateRedirect("/auth/error?reason=unavailable");
      }
    },
    async callback(request: NextRequest) {
      const id = requestId(request);
      // One-time use comes from the Identity (single-use code bound to PKCE) and from clearing the cookie below.
      const transaction = await unseal(request.cookies.get(transactionCookie)?.value, keys, transactionSchema, now());
      let response: NextResponse;
      try {
        const params = request.nextUrl.searchParams;
        if (!transaction || ["code", "state", "iss"].some(key => params.getAll(key).length !== 1) ||
            params.get("state") !== transaction.state || params.get("iss") !== env.OIDC_ISSUER ||
            !params.get("code") || params.has("error")) throw new Error("Invalid callback");
        const callback = new URL(env.APP_URL + "/auth/callback");
        callback.search = params.toString();
        const tokens = await identity.exchange(callback, transaction);
        if (tokens.accessExpiresAt <= now() + STALE_MARGIN) throw new Error("Expired access");
        const value = await sealSession(tokens, now() + env.SESSION_TTL_SECONDS * 1000);
        // The replaced session must not stay usable from a copied cookie: revoke its refresh token (best effort).
        const previous = await read(request.cookies.get(sessionCookie)?.value, { ignoreExpiry: true });
        if (previous?.refreshToken) await identity.revoke(previous.refreshToken).catch(() => log("auth.revocation_failed", { requestId: id }));
        response = privateRedirect(transaction.returnTo);
        response.cookies.set(sessionCookie, value, { ...attributes, maxAge: env.SESSION_TTL_SECONDS });
      } catch {
        log("auth.callback_denied", { requestId: id });
        response = privateRedirect("/auth/error?reason=invalid");
      }
      response.cookies.set(transactionCookie, "", { ...attributes, maxAge: 0 });
      return response;
    },
    // Fallback for renders the proxy did not renew: refresh, write the cookie and go back.
    async refresh(request: NextRequest) {
      const returnTo = internalReturnPath(request.nextUrl.searchParams.get("returnTo"), home);
      // Another site must not force a rotation (an aborted response would lose the new token): it goes through login.
      if (crossSite(request)) return privateRedirect("/auth/login?returnTo=" + encodeURIComponent(returnTo));
      const renewal = await renew(request.cookies.get(sessionCookie)?.value);
      if (renewal.kind === "ended" || !request.cookies.get(sessionCookie)?.value) {
        return applyRenewal(privateRedirect("/auth/login?returnTo=" + encodeURIComponent(returnTo)), renewal);
      }
      return applyRenewal(privateRedirect(returnTo), renewal);
    },
    async logout(request: NextRequest) {
      const id = requestId(request);
      try { assertSameOrigin(request, env.APP_URL); }
      catch (error) { return errorResponse(error, id); }
      // Revoke even an expired session: its refresh token may still be valid at the Identity.
      const session = await read(request.cookies.get(sessionCookie)?.value, { ignoreExpiry: true });
      if (session?.refreshToken) {
        try { await identity.revoke(session.refreshToken); }
        catch { log("auth.revocation_failed", { requestId: id }); }
      }
      let destination = "/";
      if (request.nextUrl.searchParams.get("identity") === "true") {
        try { destination = (await identity.logoutUrl())?.href ?? "/auth/signed-out"; }
        catch { destination = "/auth/signed-out"; }
      }
      const response = privateRedirect(destination);
      response.cookies.set(sessionCookie, "", { ...attributes, maxAge: 0 });
      response.cookies.set(transactionCookie, "", { ...attributes, maxAge: 0 });
      response.headers.set("Clear-Site-Data", '"cache"');
      log("auth.logout", { requestId: id });
      return response;
    },
  };
}
