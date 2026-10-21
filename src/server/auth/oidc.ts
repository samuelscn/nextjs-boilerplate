import "server-only";
import * as oidc from "openid-client";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import type { AuthEnvironment } from "@/config/schema";
import type { Tokens, Transaction } from "../session/records";

export interface IdentityClient {
  authorization(transaction: Omit<Transaction, "returnTo">): Promise<URL>;
  exchange(url: URL, transaction: Transaction): Promise<Tokens>;
  refresh(refreshToken: string, subject: string): Promise<Tokens>;
  revoke(refreshToken: string): Promise<void>;
  logoutUrl(): Promise<URL | null>;
}

export function createIdentityClient(env: AuthEnvironment, transport: typeof fetch = fetch): IdentityClient {
  let configuration: Promise<oidc.Configuration> | undefined;
  const issuer = new URL(env.OIDC_ISSUER);
  function validEndpoint(endpoint: string) {
    const url = new URL(endpoint);
    return url.origin === issuer.origin && !url.username && !url.password && !url.hash;
  }
  const guardedFetch: typeof fetch = async (input, init) => {
    const destination = new URL(input instanceof Request ? input.url : input.toString());
    if (destination.origin !== issuer.origin || destination.username || destination.password || destination.hash) throw new Error("Invalid Identity destination");
    return transport(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  };
  async function discover() {
    configuration ??= oidc.discovery(issuer, env.OIDC_CLIENT_ID, {
      token_endpoint_auth_method: env.OIDC_CLIENT_TYPE === "confidential" ? "client_secret_basic" : "none",
      id_token_signed_response_alg: "RS256",
    }, env.OIDC_CLIENT_TYPE === "confidential" ? oidc.ClientSecretBasic(env.OIDC_CLIENT_SECRET!) : oidc.None(), {
      [oidc.customFetch]: (url, options) => guardedFetch(url, {
        method: options.method, headers: options.headers,
        ...(options.body === undefined ? {} : { body: options.body instanceof Uint8Array ? new Uint8Array(options.body).buffer : options.body }),
      }),
      execute: [oidc.enableNonRepudiationChecks, ...(env.OIDC_ALLOW_HTTP ? [oidc.allowInsecureRequests] : [])],
    }).then(config => {
      const metadata = config.serverMetadata();
      if (metadata.issuer !== env.OIDC_ISSUER || !metadata.code_challenge_methods_supported?.includes("S256")) throw new Error("Invalid discovery");
      for (const endpoint of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]) {
        if (!endpoint || !validEndpoint(endpoint)) throw new Error("Invalid discovery endpoint");
      }
      for (const endpoint of [metadata.revocation_endpoint, metadata.end_session_endpoint]) {
        if (endpoint && !validEndpoint(endpoint)) throw new Error("Invalid discovery endpoint");
      }
      return config;
    }).catch(() => { configuration = undefined; throw new Error("Identity unavailable"); });
    return configuration;
  }
  let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
  async function validateAccess(response: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers, subject: string): Promise<Tokens> {
    const config = await discover();
    keys ??= createRemoteJWKSet(new URL(config.serverMetadata().jwks_uri!), { [customFetch]: guardedFetch, timeoutDuration: 10_000 });
    const { payload } = await jwtVerify(response.access_token, keys, {
      issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE, algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "azp"], maxTokenAge: "10m",
    });
    if (payload.sub !== subject || payload.azp !== env.OIDC_CLIENT_ID || !payload.exp ||
        response.token_type.toLowerCase() !== "bearer") throw new Error("Invalid access token");
    return {
      subject, accessToken: response.access_token, accessExpiresAt: payload.exp * 1000,
      ...(response.refresh_token ? { refreshToken: response.refresh_token } : {}),
    };
  }
  return {
    async authorization(transaction) {
      return oidc.buildAuthorizationUrl(await discover(), {
        redirect_uri: env.APP_URL + "/auth/callback", scope: "openid offline_access",
        resource: env.OIDC_AUDIENCE, state: transaction.state, nonce: transaction.nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier), code_challenge_method: "S256",
        ...(env.OIDC_MAX_AGE === undefined ? {} : { max_age: String(env.OIDC_MAX_AGE) }),
      });
    },
    async exchange(url, transaction) {
      const response = await oidc.authorizationCodeGrant(await discover(), url, {
        expectedState: transaction.state, expectedNonce: transaction.nonce,
        pkceCodeVerifier: transaction.verifier, idTokenExpected: true,
        ...(env.OIDC_MAX_AGE === undefined ? {} : { maxAge: env.OIDC_MAX_AGE }),
      }, { resource: env.OIDC_AUDIENCE });
      const subject = response.claims()?.sub;
      if (!subject) throw new Error("Invalid subject");
      return validateAccess(response, subject);
    },
    async refresh(refreshToken, subject) {
      const response = await oidc.refreshTokenGrant(await discover(), refreshToken, { resource: env.OIDC_AUDIENCE });
      if (response.claims() && response.claims()?.sub !== subject) throw new Error("Subject changed");
      // Ginga Identity rotates refresh tokens; missing replacement fails closed.
      if (!response.refresh_token) throw new Error("Missing rotated refresh token");
      return validateAccess(response, subject);
    },
    async revoke(refreshToken) {
      const config = await discover();
      if (config.serverMetadata().revocation_endpoint) await oidc.tokenRevocation(config, refreshToken, { token_type_hint: "refresh_token" });
    },
    async logoutUrl() {
      const config = await discover();
      if (!config.serverMetadata().end_session_endpoint) return null;
      // No token is put in the browser URL. Identity asks for confirmation.
      return oidc.buildEndSessionUrl(config, { client_id: env.OIDC_CLIENT_ID, post_logout_redirect_uri: env.APP_URL + "/" });
    },
  };
}
