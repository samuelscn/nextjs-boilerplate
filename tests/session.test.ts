import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createAuthService } from "@/server/auth/service";
import { parseSealKeys, seal, unseal } from "@/server/session/seal";
import { sessionSchema } from "@/server/session/records";
import { authEnv, mockIdentity, rotatedSessionSecret, testSessionSecret, tokens } from "./helpers";

const keys = parseSealKeys(testSessionSecret);
const issuer = "&iss=" + encodeURIComponent("https://identity.test/api/auth");

describe("stateless sealed sessions and login handlers", () => {
  const setup = (secrets = testSessionSecret) => {
    let now = Date.now();
    const identity = mockIdentity();
    const auth = createAuthService(authEnv(), parseSealKeys(secrets), identity, () => now);
    // Overrides may set refreshToken: undefined to drop it (JSON omits undefined).
    const session = (overrides: Record<string, unknown> = {}, ttl = 3600_000) =>
      seal({ v: 1, ...tokens(now), ...overrides, expiresAt: now + ttl }, keys, now + ttl, now);
    const transaction = (state = "state") => seal({ v: 1, state, nonce: "nonce", verifier: "v".repeat(43), returnTo: "/app" }, keys, now + 600_000, now);
    const request = (url: string, cookies: Record<string, string> = {}, init: { method?: string; origin?: string } = {}) => new NextRequest(url, {
      method: init.method ?? "GET",
      headers: { cookie: Object.entries(cookies).map(([name, value]) => name + "=" + value).join("; "), ...(init.origin ? { origin: init.origin } : {}) },
    });
    return { identity, auth, session, transaction, request, clock: { get now() { return now; }, advance: (ms: number) => { now += ms; } } };
  };

  it("seals the login transaction and the session; the browser never sees tokens", async () => {
    const { auth, identity, request } = setup();
    const login = await auth.login(new NextRequest("https://app.test/auth/login?returnTo=/app"));
    if (!(login instanceof NextResponse)) throw new Error("Expected redirect");
    const cookie = login.cookies.get("__Host-ginga_transaction")!;
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
    expect(cookie.value.split(".")).toHaveLength(5);
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    const response = await auth.callback(request("https://app.test/auth/callback?code=code&state=" + state + issuer, { [cookie.name]: cookie.value }));
    const value = response.cookies.get(auth.sessionCookie)!.value;
    expect(response.headers.get("location")).toBe("https://app.test/app");
    expect(response.cookies.get("__Host-ginga_transaction")?.maxAge).toBe(0);
    expect(identity.exchange).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ state, returnTo: "/app" }));
    expect(value).not.toContain("test-only");
    expect(value.length).toBeLessThan(3800);
    expect(await auth.getSession(value)).toMatchObject({ user: { id: "test-subject" }, stale: false });
    expect(JSON.stringify(await auth.getSession(value))).not.toMatch(/token/i);
  });
  it.each(["wrong-state", "wrong-issuer", "missing-issuer", "duplicate-code", "no-cookie", "provider-error", "forged-cookie"])("denies manipulated callback: %s", async scenario => {
    const { identity, auth, transaction, request } = setup();
    const url = new URL("https://app.test/auth/callback?code=code&state=state" + issuer);
    if (scenario === "wrong-state") url.searchParams.set("state", "attacker");
    if (scenario === "wrong-issuer") url.searchParams.set("iss", "https://evil.test");
    if (scenario === "missing-issuer") url.searchParams.delete("iss");
    if (scenario === "duplicate-code") url.searchParams.append("code", "other");
    if (scenario === "provider-error") url.searchParams.set("error", "access_denied");
    const sealed = scenario === "forged-cookie" ? await seal({ v: 1, state: "state", nonce: "n", verifier: "v".repeat(43), returnTo: "/app" }, parseSealKeys(rotatedSessionSecret), Date.now() + 60_000, Date.now()) : await transaction();
    const response = await auth.callback(request(url.href, scenario === "no-cookie" ? {} : { "__Host-ginga_transaction": sealed }));
    expect(response.headers.get("location")).toContain("reason=invalid");
    expect(response.cookies.get(auth.sessionCookie)).toBeUndefined();
    expect(identity.exchange).not.toHaveBeenCalled();
  });
  it("fails closed when the exchange rejects or the session would not fit in a cookie", async () => {
    const { auth, identity, transaction, request } = setup();
    vi.mocked(identity.exchange).mockRejectedValueOnce(new Error("verification failed"));
    const url = "https://app.test/auth/callback?code=c&state=state" + issuer;
    expect((await auth.callback(request(url, { "__Host-ginga_transaction": await transaction() }))).cookies.get(auth.sessionCookie)).toBeUndefined();
    vi.mocked(identity.exchange).mockResolvedValueOnce({ ...tokens(), accessToken: "x".repeat(2999) });
    const huge = await auth.callback(request(url, { "__Host-ginga_transaction": await transaction() }));
    expect(huge.headers.get("location")).toContain("reason=invalid");
    expect(huge.cookies.get(auth.sessionCookie)).toBeUndefined();
  });
  it("rejects tampered, foreign-key and expired sessions, and opens sessions sealed with a rotated-out key", async () => {
    const { auth, session, clock } = setup();
    const value = await session();
    expect(await auth.getSession(value.slice(0, -2) + "xx")).toBeNull();
    expect(await setup(rotatedSessionSecret).auth.getSession(value)).toBeNull();
    // New key in front: sessions sealed with the previous key still open.
    expect(await setup(rotatedSessionSecret + "," + testSessionSecret).auth.getSession(value)).toMatchObject({ user: { id: "test-subject" } });
    const short = await session({}, 60_000);
    clock.advance(60_001);
    expect(await auth.getSession(short)).toBeNull();
  });
  it("never refreshes while rendering: a stale session is flagged and its token refused", async () => {
    const { auth, identity, session, clock } = setup();
    const value = await session({ accessExpiresAt: clock.now + 10_000 });
    expect(await auth.getSession(value)).toMatchObject({ stale: true });
    await expect(auth.accessToken(value)).resolves.toBe("test-only-access-token");
    clock.advance(6_000);
    await expect(auth.accessToken(value)).rejects.toMatchObject({ status: 401 });
    expect(await auth.getSession(await session({ accessExpiresAt: clock.now, refreshToken: undefined }))).toBeNull();
    expect(identity.refresh).not.toHaveBeenCalled();
  });
  it("renews near expiry with the rotated token, keeping the absolute session end", async () => {
    const { auth, identity, session, clock } = setup();
    expect(await auth.renew(undefined)).toEqual({ kind: "unchanged" });
    expect(await auth.renew(await session())).toEqual({ kind: "unchanged" });
    const value = await session({ accessExpiresAt: clock.now + 30_000 }, 3600_000);
    const before = await unseal(value, keys, sessionSchema, clock.now);
    const renewal = await auth.renew(value);
    if (renewal.kind !== "renewed") throw new Error("Expected renewal");
    expect(identity.refresh).toHaveBeenCalledWith("test-only-refresh-token", "test-subject");
    const after = await unseal(renewal.value, keys, sessionSchema, clock.now);
    expect(after).toMatchObject({ refreshToken: "rotated-test-refresh", expiresAt: before!.expiresAt });
    expect(renewal.maxAge).toBe(3600);
    const response = auth.applyRenewal(NextResponse.next(), renewal);
    expect(response.cookies.get(auth.sessionCookie)).toMatchObject({ value: renewal.value, httpOnly: true, maxAge: 3600 });
  });
  it("shares one refresh among concurrent requests of an instance carrying the same cookie", async () => {
    const { auth, identity, session, clock } = setup();
    const value = await session({ accessExpiresAt: clock.now + 10_000 });
    const results = await Promise.all(Array.from({ length: 10 }, () => auth.renew(value)));
    expect(identity.refresh).toHaveBeenCalledOnce();
    expect(new Set(results.map(result => result.kind === "renewed" && result.value)).size).toBe(1);
    await auth.renew(value);
    expect(identity.refresh).toHaveBeenCalledTimes(2);
  });
  it("revokes the replaced session's refresh token on a new login", async () => {
    const { auth, identity, session, transaction, request } = setup();
    const previous = await session({ refreshToken: "previous-refresh" });
    const response = await auth.callback(request("https://app.test/auth/callback?code=c&state=state" + issuer, { "__Host-ginga_transaction": await transaction(), [auth.sessionCookie]: previous }));
    expect(response.headers.get("location")).toBe("https://app.test/app");
    expect(identity.revoke).toHaveBeenCalledWith("previous-refresh");
  });
  it.each(["expired", "revoked", "unavailable", "other-subject", "no-refresh-token", "tampered"])("ends the session when renewal is impossible: %s", async reason => {
    const { auth, identity, session, clock } = setup();
    if (["expired", "revoked", "unavailable"].includes(reason)) vi.mocked(identity.refresh).mockRejectedValue(new Error(reason));
    if (reason === "other-subject") vi.mocked(identity.refresh).mockResolvedValue({ ...tokens(clock.now), subject: "someone-else" });
    let value = await session({ accessExpiresAt: clock.now, ...(reason === "no-refresh-token" ? { refreshToken: undefined } : {}) });
    if (reason === "tampered") value = value.slice(0, -2) + "xx";
    const renewal = await auth.renew(value);
    expect(renewal).toEqual({ kind: "ended" });
    expect(auth.applyRenewal(NextResponse.next(), renewal).cookies.get(auth.sessionCookie)?.maxAge).toBe(0);
  });
  it("renews from /auth/refresh and returns, or sends the user to login", async () => {
    const { auth, identity, session, request, clock } = setup();
    const stale = await session({ accessExpiresAt: clock.now + 10_000 });
    const renewed = await auth.refresh(request("https://app.test/auth/refresh?returnTo=/app/orders", { [auth.sessionCookie]: stale }));
    expect(renewed.headers.get("location")).toBe("https://app.test/app/orders");
    expect(renewed.cookies.get(auth.sessionCookie)?.value).toBeTruthy();
    const external = await auth.refresh(request("https://app.test/auth/refresh?returnTo=https://evil.test", { [auth.sessionCookie]: stale }));
    expect(new URL(external.headers.get("location")!).origin).toBe("https://app.test");
    vi.mocked(identity.refresh).mockRejectedValueOnce(new Error("revoked"));
    const ended = await auth.refresh(request("https://app.test/auth/refresh?returnTo=/app/orders", { [auth.sessionCookie]: stale }));
    expect(ended.headers.get("location")).toBe("https://app.test/auth/login?returnTo=%2Fapp%2Forders");
    expect(ended.cookies.get(auth.sessionCookie)?.maxAge).toBe(0);
    expect((await auth.refresh(request("https://app.test/auth/refresh?returnTo=/app"))).headers.get("location")).toContain("/auth/login");
    // Another site cannot force a rotation: it goes through login instead.
    vi.mocked(identity.refresh).mockClear();
    const forced = await auth.refresh(new NextRequest("https://app.test/auth/refresh?returnTo=/app", { headers: { cookie: auth.sessionCookie + "=" + stale, "sec-fetch-site": "cross-site" } }));
    expect(forced.headers.get("location")).toBe("https://app.test/auth/login?returnTo=%2Fapp");
    expect(identity.refresh).not.toHaveBeenCalled();
  });
  it("requires same origin for logout, revokes even an expired session and clears cookies if Identity fails", async () => {
    const { auth, identity, session, request, clock } = setup();
    const value = await session({}, 60_000);
    vi.mocked(identity.revoke).mockRejectedValue(new Error("offline"));
    const url = "https://app.test/auth/logout";
    expect((await auth.logout(request(url, { [auth.sessionCookie]: value }, { method: "POST", origin: "https://evil.test" }))).status).toBe(403);
    expect(identity.revoke).not.toHaveBeenCalled();
    clock.advance(120_000);
    const response = await auth.logout(request(url, { [auth.sessionCookie]: value }, { method: "POST", origin: "https://app.test" }));
    expect(response.status).toBe(303);
    expect(identity.revoke).toHaveBeenCalledWith("test-only-refresh-token");
    expect(response.headers.get("set-cookie")).toContain(auth.sessionCookie + "=; Path=/; Max-Age=0");
  });
});
