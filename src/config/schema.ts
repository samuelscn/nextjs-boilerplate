import { z } from "zod";
import template from "../../template.config.json";
import { safeServiceUrl } from "../lib/validation/urls";
import { supportedLocales, defaultLocale } from "../i18n/config";
import { parseFlags } from "./flags";
import { parseSealKeys } from "../server/session/seal";

const flag = z.enum(["true", "false"]).transform(value => value === "true");
const core = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_KIND: z.enum(["public", "app", "backoffice"]).default(template.defaultKind as "public"),
  APP_URL: z.string().default("http://localhost:3000"),
  APP_NAME: z.string().trim().min(1).max(80).default("Ginga Application"),
  I18N_DEFAULT_LOCALE: z.enum(supportedLocales).default(defaultLocale),
  I18N_URL_STRATEGY: z.enum(["public-prefix", "cookie"]).default(template.i18n.urlStrategy.public as "public-prefix" | "cookie"),
  FEATURE_FLAGS: z.string().max(4096).optional(),
  // Server-side error tracking (src/server/error-tracking.ts); unset = disabled.
  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().trim().min(1).max(64).optional(),
  SENTRY_RELEASE: z.string().trim().min(1).max(200).optional(),
  // Injected by Vercel; default Sentry release.
  VERCEL_GIT_COMMIT_SHA: z.string().trim().min(1).max(64).optional(),
});
const auth = z.object({
  // fake: development-only stand-in for the Identity (src/server/auth/fake.ts); refused in production.
  AUTH_PROVIDER: z.enum(["oidc", "fake"]).default("oidc"),
  OIDC_ISSUER: z.string().min(1),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_TYPE: z.enum(["confidential", "public"]).default("confidential"),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_ALLOW_HTTP: flag.default(false),
  OIDC_MAX_AGE: z.coerce.number().int().min(0).max(86400).optional(),
  // Comma-separated base64url 32-byte keys sealing the session cookie; the first seals, all open (rotation).
  SESSION_SECRETS: z.string().min(43).max(2048),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(28800).default(28800),
  PRODUCT_API_URL: z.string().optional(),
  // Data source of Product API operations: in-process mock adapters or the real API.
  // Defaults to mock outside production; mock in production fails at boot.
  API_MODE: z.enum(["mock", "live"]).optional(),
  // Mock only: comma-separated permissions of the signed-in user ("*" = all) to exercise restricted UIs.
  API_MOCK_PERMISSIONS: z.string().max(4096).default("*"),
});
const schema = core.superRefine((value, ctx) => {
  if (!safeServiceUrl(value.APP_URL, value.NODE_ENV !== "production") ||
      new URL(value.APP_URL).origin !== value.APP_URL) {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Expected canonical origin; HTTPS in production" });
  }
  try { parseFlags(value.FEATURE_FLAGS); } catch { ctx.addIssue({ code: "custom", path: ["FEATURE_FLAGS"], message: "Invalid configuration" }); }
});
// Feature flags resolved once from FEATURE_FLAGS; the raw string never leaves config.
const withFlags = <T extends { FEATURE_FLAGS?: string | undefined }>({ FEATURE_FLAGS, ...value }: T) => ({ ...value, flags: parseFlags(FEATURE_FLAGS) });
export function parseEnv(input: Record<string, string | undefined>) {
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === "" ? undefined : value]));
  const base = schema.safeParse(normalized);
  if (!base.success) throw configError(base.error);
  if (base.data.APP_KIND === "public") return { ...withFlags(base.data), APP_KIND: "public" as const };
  // The fake provider replaces the Identity entirely: its OIDC values are fixed, never read from the environment.
  const fake = normalized.AUTH_PROVIDER === "fake";
  const authInput = fake ? { ...normalized, ...fakeOidc(base.data.APP_URL, normalized.PRODUCT_API_URL) } : normalized;
  const result = auth.superRefine((value, ctx) => {
    const issue = (key: string) => ctx.addIssue({ code: "custom", path: [key], message: "Invalid configuration" });
    const production = base.data.NODE_ENV === "production";
    if (fake && production) issue("AUTH_PROVIDER");
    if (value.OIDC_ALLOW_HTTP && production) issue("OIDC_ALLOW_HTTP");
    if (!fake && (!safeServiceUrl(value.OIDC_ISSUER, value.OIDC_ALLOW_HTTP) || new URL(value.OIDC_ISSUER).search)) issue("OIDC_ISSUER");
    if (!fake && (!safeServiceUrl(value.OIDC_AUDIENCE, value.OIDC_ALLOW_HTTP) || new URL(value.OIDC_AUDIENCE).origin !== value.OIDC_AUDIENCE)) issue("OIDC_AUDIENCE");
    if (value.PRODUCT_API_URL && (!safeServiceUrl(value.PRODUCT_API_URL, !production) || new URL(value.PRODUCT_API_URL).search)) issue("PRODUCT_API_URL");
    if (value.OIDC_CLIENT_TYPE === "confidential" && !value.OIDC_CLIENT_SECRET) issue("OIDC_CLIENT_SECRET");
    if (value.OIDC_CLIENT_TYPE === "public" && value.OIDC_CLIENT_SECRET) issue("OIDC_CLIENT_SECRET");
    try { parseSealKeys(value.SESSION_SECRETS); } catch { issue("SESSION_SECRETS"); }
    if (production && value.API_MODE === "mock") issue("API_MODE");
  }).safeParse(authInput);
  if (!result.success) throw configError(result.error);
  const API_MODE = result.data.API_MODE ?? (base.data.NODE_ENV === "production" ? "live" : "mock");
  return { ...withFlags(base.data), ...result.data, API_MODE, APP_KIND: base.data.APP_KIND };
}
function fakeOidc(appUrl: string, productApiUrl: string | undefined) {
  let audience = appUrl;
  try { if (productApiUrl) audience = new URL(productApiUrl).origin; } catch { /* PRODUCT_API_URL is validated below */ }
  return { OIDC_ISSUER: appUrl + "/auth/fake", OIDC_CLIENT_ID: "fake-client", OIDC_CLIENT_TYPE: "public", OIDC_CLIENT_SECRET: undefined, OIDC_AUDIENCE: audience };
}
function configError(error: z.ZodError) {
  // Never include rejected input, Zod messages or secrets in logs.
  return new Error("Invalid environment: " + [...new Set(error.issues.map(issue => issue.path.join(".")))].join(", "));
}
export type Environment = ReturnType<typeof parseEnv>;
export type AuthEnvironment = Exclude<Environment, { APP_KIND: "public" }>;
