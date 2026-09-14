import { beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createIdentityClient } from "@/server/auth/oidc";
import { authEnv } from "./helpers";
import type { Transaction } from "@/server/session/store";

describe("real openid-client validation at the HTTP boundary", () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  beforeAll(async () => { keys = await generateKeyPair("RS256"); });
  const env = authEnv();
  const transaction: Transaction = { state: "expected-state", nonce: "expected-nonce", verifier: "a".repeat(43), returnTo: "/app", expiresAt: Date.now() + 600_000 };
  async function fixture(overrides: { nonce?: string; issuer?: string; audience?: string; sub?: string; signature?: boolean; discoveryIssuer?: string } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const signingKey = overrides.signature === false ? (await generateKeyPair("RS256")).privateKey : keys.privateKey;
    const access = await new SignJWT({ azp: env.OIDC_CLIENT_ID }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject(overrides.sub ?? "subject").setIssuer(overrides.issuer ?? env.OIDC_ISSUER).setAudience(overrides.audience ?? env.OIDC_AUDIENCE)
      .setIssuedAt(now).setExpirationTime(now + 300).sign(signingKey);
    const id = await new SignJWT({ nonce: overrides.nonce ?? transaction.nonce }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject("subject").setIssuer(env.OIDC_ISSUER).setAudience(env.OIDC_CLIENT_ID).setIssuedAt(now).setExpirationTime(now + 300).sign(signingKey);
    const metadata = {
      issuer: overrides.discoveryIssuer ?? env.OIDC_ISSUER,
      authorization_endpoint: env.OIDC_ISSUER + "/oauth2/authorize", token_endpoint: env.OIDC_ISSUER + "/oauth2/token",
      jwks_uri: env.OIDC_ISSUER + "/jwks", revocation_endpoint: env.OIDC_ISSUER + "/oauth2/revoke",
      end_session_endpoint: env.OIDC_ISSUER + "/oauth2/end-session",
      code_challenge_methods_supported: ["S256"], response_types_supported: ["code"],
      subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      authorization_response_iss_parameter_supported: true,
    };
    const jwk = { ...await exportJWK(keys.publicKey), kid: "test-key", alg: "RS256", use: "sig" };
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("openid-configuration")) return Response.json(metadata);
      if (url.endsWith("/jwks")) return Response.json({ keys: [jwk] });
      if (url.endsWith("/revoke")) return new Response(null, { status: 200 });
      if (url.endsWith("/token")) {
        const body = new URLSearchParams(String(init?.body));
        const isRefresh = body.get("grant_type") === "refresh_token";
        return Response.json({ access_token: access, refresh_token: "test-rotated-refresh", token_type: "Bearer", expires_in: 300, ...(isRefresh ? {} : { id_token: id }) });
      }
      throw new Error("Unexpected request");
    });
    return { client: createIdentityClient(env, transport), transport, access };
  }
  const callback = () => new URL("https://app.test/auth/callback?code=test-code&state=expected-state&iss=" + encodeURIComponent(env.OIDC_ISSUER));
  it("uses discovery, S256, nonce, state and resource with minimal scopes", async () => {
    const { client } = await fixture();
    const first = await client.authorization(transaction);
    expect(first.origin).toBe("https://identity.test");
    expect(first.searchParams.get("scope")).toBe("openid offline_access");
    expect(first.searchParams.get("code_challenge_method")).toBe("S256");
    expect(first.searchParams.get("code_challenge")).toHaveLength(43);
    expect(first.searchParams.get("code_challenge")).not.toBe(transaction.verifier);
    expect(first.searchParams.get("nonce")).toBe(transaction.nonce);
    expect(first.searchParams.get("resource")).toBe(env.OIDC_AUDIENCE);
  });
  it("validates signatures, issuer, audience and exchanges PKCE via confidential client auth", async () => {
    const { client, transport, access } = await fixture();
    expect(await client.exchange(callback(), transaction)).toMatchObject({ subject: "subject", accessToken: access });
    const call = transport.mock.calls.find(([url]) => String(url).endsWith("/token"))!;
    const body = new URLSearchParams(String(call[1]?.body));
    expect(body.get("code_verifier")).toBe(transaction.verifier);
    expect(body.get("resource")).toBe(env.OIDC_AUDIENCE);
    expect(new Headers(call[1]?.headers).get("authorization")).toMatch(/^Basic /u);
    expect(call[1]).toMatchObject({ cache: "no-store", redirect: "error" });
  });
  it.each([
    { nonce: "wrong" }, { issuer: "https://evil.test" }, { audience: "https://other-api.test" },
    { sub: "different-subject" }, { signature: false }, { discoveryIssuer: "https://evil.test" },
  ])("denies invalid cryptographic or claim boundary: %j", async overrides => {
    const { client } = await fixture(overrides);
    await expect(client.exchange(callback(), transaction)).rejects.toThrow();
  });
  it("the library independently rejects invalid state and issuer", async () => {
    const { client } = await fixture();
    const url = callback(); url.searchParams.set("state", "wrong");
    await expect(client.exchange(url, transaction)).rejects.toThrow();
    const issuerUrl = callback(); issuerUrl.searchParams.set("iss", "https://evil.test");
    await expect(client.exchange(issuerUrl, transaction)).rejects.toThrow();
  });
  it("refreshes for the same subject, revokes, and builds token-free logout", async () => {
    const { client, transport } = await fixture();
    expect(await client.refresh("old-test-refresh", "subject")).toMatchObject({ subject: "subject", refreshToken: "test-rotated-refresh" });
    await client.revoke("test-rotated-refresh");
    expect(transport.mock.calls.some(([url]) => String(url).endsWith("/revoke"))).toBe(true);
    const logout = await client.logoutUrl();
    expect(logout?.searchParams.has("id_token_hint")).toBe(false);
    expect(logout?.searchParams.get("client_id")).toBe(env.OIDC_CLIENT_ID);
  });
});
