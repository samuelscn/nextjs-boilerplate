import { parseEnv, type AuthEnvironment } from "@/config/schema";
import type { IdentityClient } from "@/server/auth/oidc";
import { vi } from "vitest";

// Test-only keys (base64url, 32 bytes). Never reuse outside tests.
export const testSessionSecret = "dGVzdC1vbmx5LXNlc3Npb24ta2V5LTMyLWJ5dGVzISE";
export const rotatedSessionSecret = "cm90YXRlZC10ZXN0LXNlc3Npb24ta2V5LTMyLWJ5dGU";
export function authEnv(overrides: Record<string, string> = {}): AuthEnvironment {
  const env = parseEnv({
    NODE_ENV: "test", APP_KIND: "app", APP_URL: "https://app.test",
    OIDC_ISSUER: "https://identity.test/api/auth", OIDC_CLIENT_ID: "test-client",
    OIDC_CLIENT_SECRET: "test-only-client-secret", OIDC_AUDIENCE: "https://api.test", SESSION_SECRETS: testSessionSecret, ...overrides,
  });
  if (env.APP_KIND === "public") throw new Error("Expected auth config");
  return env;
}
export const tokens = (now = Date.now()) => ({
  subject: "test-subject", accessToken: "test-only-access-token", refreshToken: "test-only-refresh-token", accessExpiresAt: now + 300_000,
});
export function mockIdentity(): IdentityClient {
  return {
    authorization: vi.fn(async transaction => {
      const url = new URL("https://identity.test/api/auth/oauth2/authorize");
      url.searchParams.set("state", transaction.state);
      return url;
    }),
    exchange: vi.fn(async () => tokens()),
    refresh: vi.fn(async () => ({ ...tokens(), refreshToken: "rotated-test-refresh" })),
    revoke: vi.fn(async () => {}),
    logoutUrl: vi.fn(async () => new URL("https://identity.test/api/auth/oauth2/end-session")),
  };
}
