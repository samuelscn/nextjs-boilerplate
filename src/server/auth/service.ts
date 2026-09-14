import "server-only";
import * as oidc from "openid-client";
import { NextRequest, NextResponse } from "next/server";
import type { AuthEnvironment } from "@/config/schema";
import { HttpError } from "@/lib/http/error";
import { internalReturnPath } from "@/lib/validation/urls";
import { assertSameOrigin } from "../security/csrf";
import { errorResponse, requestId } from "../http";
import { log } from "../logging";
import { SessionStore, type SessionRecord } from "../session/store";
import type { IdentityClient } from "./oidc";

export type PublicSession = { user: { id: string }; expiresAt: number };

export function createAuthService(env: AuthEnvironment, store: SessionStore, identity: IdentityClient, now: () => number = Date.now) {
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
  async function record(id: string | undefined): Promise<SessionRecord | null> {
    const existing = store.get(id);
    if (!id || !existing) return null;
    if (existing.accessExpiresAt > now() + 30_000) return existing;
    const pending = store.refreshes.get(id);
    if (pending) return pending;
    const refreshToken = existing.refreshToken;
    if (!refreshToken) { store.destroy(id); return null; }
    const refresh = Promise.resolve().then(async () => {
      try {
        const tokens = await identity.refresh(refreshToken, existing.subject);
        if (tokens.subject !== existing.subject || tokens.accessExpiresAt <= now() + 30_000) throw new Error("Invalid refresh");
        const next = { ...tokens, expiresAt: existing.expiresAt };
        if (store.replace(id, existing, next)) return next;
        if (tokens.refreshToken) await identity.revoke(tokens.refreshToken);
        return null;
      } catch {
        store.destroy(id);
        log("session.refresh_failed");
        return null;
      }
    }).finally(() => { store.refreshes.delete(id); });
    store.refreshes.set(id, refresh);
    return refresh;
  }
  return {
    sessionCookie,
    async getSession(id: string | undefined): Promise<PublicSession | null> {
      const session = await record(id);
      return session ? { user: { id: session.subject }, expiresAt: session.expiresAt } : null;
    },
    async accessToken(id: string | undefined): Promise<string> {
      const session = await record(id);
      if (!session) throw new HttpError(401, "unauthorized");
      return session.accessToken;
    },
    invalidate(id: string) { store.destroy(id); },
    async login(request: NextRequest) {
      const id = requestId(request);
      try {
        if (request.headers.get("purpose") === "prefetch" || request.headers.has("next-router-prefetch")) return new Response(null, { status: 204 });
        const transaction = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(),
          returnTo: internalReturnPath(request.nextUrl.searchParams.get("returnTo"), home) };
        const destination = await identity.authorization(transaction);
        const old = request.cookies.get(transactionCookie)?.value;
        if (old) store.consume(old);
        const handle = store.begin(transaction);
        const response = privateRedirect(destination.href);
        response.cookies.set(transactionCookie, handle, { ...attributes, maxAge: 600 });
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
      const transaction = store.consume(request.cookies.get(transactionCookie)?.value);
      let response: NextResponse;
      try {
        const params = request.nextUrl.searchParams;
        if (!transaction || ["code", "state", "iss"].some(key => params.getAll(key).length !== 1) ||
            params.get("state") !== transaction.state || params.get("iss") !== env.OIDC_ISSUER ||
            !params.get("code") || params.has("error")) throw new Error("Invalid callback");
        const callback = new URL(env.APP_URL + "/auth/callback");
        callback.search = params.toString();
        const tokens = await identity.exchange(callback, transaction);
        if (tokens.accessExpiresAt <= now() + 30_000) throw new Error("Expired access");
        const handle = store.create(tokens, env.SESSION_TTL_SECONDS);
        const previous = request.cookies.get(sessionCookie)?.value;
        if (previous) store.destroy(previous);
        response = privateRedirect(transaction.returnTo);
        response.cookies.set(sessionCookie, handle, { ...attributes, maxAge: env.SESSION_TTL_SECONDS });
      } catch {
        log("auth.callback_denied", { requestId: id });
        response = privateRedirect("/auth/error?reason=invalid");
      }
      response.cookies.set(transactionCookie, "", { ...attributes, maxAge: 0 });
      return response;
    },
    async logout(request: NextRequest) {
      const id = requestId(request);
      try { assertSameOrigin(request, env.APP_URL); }
      catch (error) { return errorResponse(error, id); }
      const handle = request.cookies.get(sessionCookie)?.value;
      const session = store.get(handle);
      if (handle) store.destroy(handle);
      // A refresh already in flight must never resurrect the session.
      const pending = handle ? store.refreshes.get(handle) : undefined;
      if (pending) await pending;
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
