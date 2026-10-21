import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { parseEnv } from "@/config/schema";
import { createAuthService } from "@/server/auth/service";
import { createFakeIdentityClient, FAKE_USERS } from "@/server/auth/fake";
import { parseSealKeys } from "@/server/session/seal";
import { testSessionSecret } from "./helpers";

const fakeEnv = (overrides: Record<string, string> = {}) => {
  const env = parseEnv({
    NODE_ENV: "development", APP_KIND: "backoffice", APP_URL: "http://localhost:3000",
    AUTH_PROVIDER: "fake", SESSION_SECRETS: testSessionSecret, ...overrides,
  });
  if (env.APP_KIND === "public") throw new Error("Expected auth config");
  return env;
};

describe("fake identity provider (development only)", () => {
  it("needs no Identity configuration and ignores OIDC values from the environment", () => {
    const env = fakeEnv({ OIDC_ISSUER: "https://identity.example.com/api/auth", OIDC_CLIENT_SECRET: "ignored", PRODUCT_API_URL: "http://localhost:5000/v1" });
    expect(env).toMatchObject({
      AUTH_PROVIDER: "fake", OIDC_ISSUER: "http://localhost:3000/auth/fake", OIDC_CLIENT_ID: "fake-client",
      OIDC_CLIENT_TYPE: "public", OIDC_AUDIENCE: "http://localhost:5000",
    });
    expect(env.OIDC_CLIENT_SECRET).toBeUndefined();
  });

  it("is refused in production", () => {
    expect(() => fakeEnv({ NODE_ENV: "production", APP_URL: "https://app.example.com" })).toThrow("AUTH_PROVIDER");
  });

  it("runs the real login, callback, renewal and token forwarding with the API's fake tokens", async () => {
    let now = Date.now();
    const env = fakeEnv();
    const auth = createAuthService(env, parseSealKeys(testSessionSecret), createFakeIdentityClient(env, () => now), () => now);
    const login = await auth.login(new NextRequest("http://localhost:3000/auth/login?returnTo=/backoffice/users"));
    if (!(login instanceof NextResponse)) throw new Error("Expected redirect");
    const location = new URL(login.headers.get("location")!);
    expect(location.pathname).toBe("/auth/fake");
    const transaction = login.cookies.get("ginga_transaction")!;
    const callback = "http://localhost:3000/auth/callback?" + new URLSearchParams({ code: "admin", state: location.searchParams.get("state")!, iss: env.OIDC_ISSUER });
    const signedIn = await auth.callback(new NextRequest(callback, { headers: { cookie: `ginga_transaction=${transaction.value}` } }));
    expect(signedIn.headers.get("location")).toBe("http://localhost:3000/backoffice/users");
    const session = signedIn.cookies.get(auth.sessionCookie)!.value;
    expect(await auth.getSession(session)).toMatchObject({ user: { id: "usr_fake_admin" }, stale: false });
    expect(await auth.accessToken(session)).toBe("fake-token-admin");

    now += 10 * 60_000;
    const renewal = await auth.renew(session);
    expect(renewal.kind).toBe("renewed");
    if (renewal.kind !== "renewed") return;
    expect(await auth.accessToken(renewal.value)).toBe("fake-token-admin");
  });

  it("rejects unknown users and a tampered state", async () => {
    const env = fakeEnv();
    const auth = createAuthService(env, parseSealKeys(testSessionSecret), createFakeIdentityClient(env));
    const login = await auth.login(new NextRequest("http://localhost:3000/auth/login"));
    if (!(login instanceof NextResponse)) throw new Error("Expected redirect");
    const cookie = `ginga_transaction=${login.cookies.get("ginga_transaction")!.value}`;
    const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
    for (const [code, value] of [["root", state], ["admin", "forged"]] as const) {
      const response = await auth.callback(new NextRequest("http://localhost:3000/auth/callback?" + new URLSearchParams({ code, state: value, iss: env.OIDC_ISSUER }), { headers: { cookie } }));
      expect(response.headers.get("location")).toBe("http://localhost:3000/auth/error?reason=invalid");
    }
  });

  it("mirrors the API's fake identities", () => {
    expect(FAKE_USERS.map(user => [user.accessToken, user.subject])).toEqual([
      ["fake-token-admin", "usr_fake_admin"], ["fake-token-user-a", "usr_fake_a"], ["fake-token-user-b", "usr_fake_b"],
      ["fake-token-stranger", "usr_fake_stranger"], ["fake-token-invitee", "usr_fake_invitee"],
    ]);
  });
});
