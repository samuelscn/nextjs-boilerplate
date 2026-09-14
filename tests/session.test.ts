import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { SessionStore } from "@/server/session/store";
import { createAuthService } from "@/server/auth/service";
import { authEnv, mockIdentity, tokens } from "./helpers";

describe("server-side sessions and login handlers", () => {
  const setup = () => {
    const now = Date.now();
    const store = new SessionStore(() => now);
    const identity = mockIdentity();
    const env = authEnv();
    const auth = createAuthService(env, store, identity, () => now);
    return { now, store, identity, auth, env };
  };
  it("uses opaque cookies and validates callbacks before creating a session", async () => {
    const { auth, store, identity } = setup();
    const login = await auth.login(new NextRequest("https://app.test/auth/login?returnTo=/app"));
    expect(login).toBeInstanceOf(NextResponse);
    if (!(login instanceof NextResponse)) throw new Error("Expected redirect");
    const cookie = login.cookies.get("__Host-ginga_transaction")!;
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(cookie.value).toHaveLength(43);
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const callback = new NextRequest("https://app.test/auth/callback?code=code&state=" + state + "&iss=" + encodeURIComponent("https://identity.test/api/auth"), { headers: { cookie: cookie.name + "=" + cookie.value } });
    const response = await auth.callback(callback);
    const sessionId = response.cookies.get(auth.sessionCookie)!.value;
    expect(response.headers.get("location")).toBe("https://app.test/app");
    expect(identity.exchange).toHaveBeenCalledOnce();
    expect(await auth.getSession(sessionId)).toEqual({ user: { id: "test-subject" }, expiresAt: store.get(sessionId)!.expiresAt });
    expect(JSON.stringify(await auth.getSession(sessionId))).not.toMatch(/token/i);
    expect(response.headers.get("set-cookie")).not.toContain("test-only");
    expect((await auth.callback(callback)).headers.get("location")).toContain("reason=invalid");
  });
  it.each(["wrong-state", "wrong-issuer", "missing-issuer", "duplicate-code", "no-cookie", "provider-error"])("denies manipulated callback: %s", async scenario => {
    const { store, identity, auth } = setup();
    const handle = store.begin({ state: "state", nonce: "nonce", verifier: "verifier", returnTo: "/app" });
    const url = new URL("https://app.test/auth/callback?code=code&state=state&iss=https%3A%2F%2Fidentity.test%2Fapi%2Fauth");
    if (scenario === "wrong-state") url.searchParams.set("state", "attacker");
    if (scenario === "wrong-issuer") url.searchParams.set("iss", "https://evil.test");
    if (scenario === "missing-issuer") url.searchParams.delete("iss");
    if (scenario === "duplicate-code") url.searchParams.append("code", "other");
    if (scenario === "provider-error") url.searchParams.set("error", "access_denied");
    const response = await auth.callback(new NextRequest(url, { headers: scenario === "no-cookie" ? {} : { cookie: "__Host-ginga_transaction=" + handle } }));
    expect(response.headers.get("location")).toContain("reason=invalid");
    expect(response.cookies.get(auth.sessionCookie)).toBeUndefined();
    expect(identity.exchange).not.toHaveBeenCalled();
  });
  it("fails closed when nonce, PKCE or signature verification rejects", async () => {
    const { auth, store, identity } = setup();
    vi.mocked(identity.exchange).mockRejectedValue(new Error("verification failed"));
    const handle = store.begin({ state: "state", nonce: "nonce", verifier: "verifier", returnTo: "/app" });
    const response = await auth.callback(new NextRequest("https://app.test/auth/callback?code=c&state=state&iss=https%3A%2F%2Fidentity.test%2Fapi%2Fauth", { headers: { cookie: "__Host-ginga_transaction=" + handle } }));
    expect(response.cookies.get(auth.sessionCookie)).toBeUndefined();
  });
  it("refreshes once under concurrent requests and rotates the token", async () => {
    const { auth, store, identity, now } = setup();
    const id = store.create({ ...tokens(now), accessExpiresAt: now }, 3600);
    const results = await Promise.all(Array.from({ length: 20 }, () => auth.getSession(id)));
    expect(results.every(Boolean)).toBe(true);
    expect(identity.refresh).toHaveBeenCalledOnce();
    expect(store.get(id)?.refreshToken).toBe("rotated-test-refresh");
  });
  it.each(["expired", "revoked", "unavailable"])("invalidates session when refresh is %s", async reason => {
    const { auth, store, identity, now } = setup();
    vi.mocked(identity.refresh).mockRejectedValue(new Error(reason));
    const id = store.create({ ...tokens(now), accessExpiresAt: now }, 3600);
    expect(await auth.getSession(id)).toBeNull();
    expect(store.get(id)).toBeNull();
    await expect(auth.accessToken(id)).rejects.toMatchObject({ status: 401 });
  });
  it("expires sessions and one-time transactions", () => {
    let now = 0;
    const store = new SessionStore(() => now);
    const session = store.create(tokens(0), 60);
    const transaction = store.begin({ state: "s", nonce: "n", verifier: "v", returnTo: "/app" });
    now = 600_001;
    expect(store.get(session)).toBeNull();
    expect(store.consume(transaction)).toBeNull();
    expect(store.get("forged")).toBeNull();
  });
  it("bounds session and login memory", () => {
    const store = new SessionStore(Date.now, 1);
    store.create(tokens(), 3600);
    expect(() => store.create(tokens(), 3600)).toThrow("session_capacity");
  });
  it("requires same origin for logout and destroys local state even if Identity fails", async () => {
    const { auth, store, identity } = setup();
    const id = store.create(tokens(), 3600);
    vi.mocked(identity.revoke).mockRejectedValue(new Error("offline"));
    const headers = { cookie: auth.sessionCookie + "=" + id, origin: "https://evil.test" };
    expect((await auth.logout(new NextRequest("https://app.test/auth/logout", { method: "POST", headers }))).status).toBe(403);
    expect(store.get(id)).not.toBeNull();
    headers.origin = "https://app.test";
    const response = await auth.logout(new NextRequest("https://app.test/auth/logout", { method: "POST", headers }));
    expect(response.status).toBe(303);
    expect(store.get(id)).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("does not resurrect a session logged out during refresh", async () => {
    const { auth, store, identity, now } = setup();
    let finish!: (value: ReturnType<typeof tokens>) => void;
    vi.mocked(identity.refresh).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const id = store.create({ ...tokens(now), accessExpiresAt: now }, 3600);
    const read = auth.getSession(id);
    await Promise.resolve();
    const logout = auth.logout(new NextRequest("https://app.test/auth/logout", { method: "POST", headers: { origin: "https://app.test", cookie: auth.sessionCookie + "=" + id } }));
    finish({ ...tokens(now), refreshToken: "rotated-after-logout" });
    await logout;
    expect(await read).toBeNull();
    expect(store.get(id)).toBeNull();
    expect(identity.revoke).toHaveBeenCalledWith("rotated-after-logout");
  });
  it("clears refresh locks after synchronous failure or missing refresh token", async () => {
    const { auth, store, identity, now } = setup();
    vi.mocked(identity.refresh).mockImplementation(() => { throw new Error("sync failure"); });
    const first = store.create({ ...tokens(now), accessExpiresAt: now }, 3600);
    expect(await auth.getSession(first)).toBeNull();
    const second = store.create({ subject: "subject", accessToken: "expired", accessExpiresAt: now }, 3600);
    expect(await auth.getSession(second)).toBeNull();
    expect(store.refreshes.size).toBe(0);
  });
});
