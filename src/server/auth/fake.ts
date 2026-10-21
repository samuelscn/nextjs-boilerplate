import "server-only";
import type { AuthEnvironment } from "@/config/schema";
import type { Tokens } from "../session/records";
import type { IdentityClient } from "./oidc";

// Development-only stand-in for the Ginga Identity (AUTH_PROVIDER=fake, refused in production).
// Same identities and access tokens as the API's fake provider (nestjs-boilerplate FAKE_IDENTITY_TOKENS),
// so API_MODE=live reaches a local API running IDENTITY_PROVIDER=fake with real data and permissions.
export const FAKE_USERS = [
  { key: "admin", subject: "usr_fake_admin", accessToken: "fake-token-admin" },
  { key: "user-a", subject: "usr_fake_a", accessToken: "fake-token-user-a" },
  { key: "user-b", subject: "usr_fake_b", accessToken: "fake-token-user-b" },
  { key: "stranger", subject: "usr_fake_stranger", accessToken: "fake-token-stranger" },
  { key: "invitee", subject: "usr_fake_invitee", accessToken: "fake-token-invitee" },
] as const;
export type FakeUserKey = typeof FAKE_USERS[number]["key"];

// Short access lifetime so the proxy's renewal path runs during normal development.
const ACCESS_TTL = 10 * 60_000;
const REFRESH_PREFIX = "fake-refresh:";

export function createFakeIdentityClient(env: AuthEnvironment, now: () => number = Date.now): IdentityClient {
  const tokens = (user: typeof FAKE_USERS[number]): Tokens => ({
    subject: user.subject, accessToken: user.accessToken, accessExpiresAt: now() + ACCESS_TTL,
    refreshToken: REFRESH_PREFIX + user.key,
  });
  return {
    // The real flow (state, nonce, PKCE transaction cookie, callback) still runs; only the sign-in page is local.
    async authorization(transaction) {
      const url = new URL(env.APP_URL + "/auth/fake");
      url.searchParams.set("state", transaction.state);
      return url;
    },
    async exchange(url) {
      const user = FAKE_USERS.find(candidate => candidate.key === url.searchParams.get("code"));
      if (!user) throw new Error("Unknown fake user");
      return tokens(user);
    },
    async refresh(refreshToken, subject) {
      const user = FAKE_USERS.find(candidate => REFRESH_PREFIX + candidate.key === refreshToken);
      if (!user || user.subject !== subject) throw new Error("Invalid fake refresh token");
      return tokens(user);
    },
    async revoke() {},
    async logoutUrl() { return null; },
  };
}
