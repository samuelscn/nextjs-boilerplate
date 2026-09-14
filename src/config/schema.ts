import { z } from "zod";
import template from "../../template.config.json";
import { safeServiceUrl } from "../lib/validation/urls";

const flag = z.enum(["true", "false"]).transform(value => value === "true");
const core = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_KIND: z.enum(["public", "app", "backoffice"]).default(template.defaultKind as "public"),
  APP_URL: z.string().default("http://localhost:3000"),
  APP_NAME: z.string().trim().min(1).max(80).default("Ginga Application"),
});
const auth = z.object({
  OIDC_ISSUER: z.string().min(1),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_TYPE: z.enum(["confidential", "public"]).default("confidential"),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_ALLOW_HTTP: flag.default(false),
  OIDC_MAX_AGE: z.coerce.number().int().min(0).max(86400).optional(),
  SESSION_STORE: z.literal("memory").default("memory"),
  SESSION_SINGLE_PROCESS: flag.default(false),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(28800).default(28800),
  PRODUCT_API_URL: z.string().optional(),
});
const schema = core.superRefine((value, ctx) => {
  if (!safeServiceUrl(value.APP_URL, value.NODE_ENV !== "production") ||
      new URL(value.APP_URL).origin !== value.APP_URL) {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Expected canonical origin; HTTPS in production" });
  }
});
export function parseEnv(input: Record<string, string | undefined>) {
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === "" ? undefined : value]));
  const base = schema.safeParse(normalized);
  if (!base.success) throw configError(base.error);
  if (base.data.APP_KIND === "public") return { ...base.data, APP_KIND: "public" as const };
  const result = auth.superRefine((value, ctx) => {
    const issue = (key: string) => ctx.addIssue({ code: "custom", path: [key], message: "Invalid configuration" });
    const production = base.data.NODE_ENV === "production";
    if (value.OIDC_ALLOW_HTTP && production) issue("OIDC_ALLOW_HTTP");
    if (!safeServiceUrl(value.OIDC_ISSUER, value.OIDC_ALLOW_HTTP) || new URL(value.OIDC_ISSUER).search) issue("OIDC_ISSUER");
    if (!safeServiceUrl(value.OIDC_AUDIENCE, value.OIDC_ALLOW_HTTP) || new URL(value.OIDC_AUDIENCE).origin !== value.OIDC_AUDIENCE) issue("OIDC_AUDIENCE");
    if (value.PRODUCT_API_URL && (!safeServiceUrl(value.PRODUCT_API_URL, !production) || new URL(value.PRODUCT_API_URL).search)) issue("PRODUCT_API_URL");
    if (value.OIDC_CLIENT_TYPE === "confidential" && !value.OIDC_CLIENT_SECRET) issue("OIDC_CLIENT_SECRET");
    if (value.OIDC_CLIENT_TYPE === "public" && value.OIDC_CLIENT_SECRET) issue("OIDC_CLIENT_SECRET");
    if (production && !value.SESSION_SINGLE_PROCESS) issue("SESSION_SINGLE_PROCESS");
  }).safeParse(normalized);
  if (!result.success) throw configError(result.error);
  return { ...base.data, ...result.data, APP_KIND: base.data.APP_KIND };
}
function configError(error: z.ZodError) {
  // Never include rejected input, Zod messages or secrets in logs.
  return new Error("Invalid environment: " + [...new Set(error.issues.map(issue => issue.path.join(".")))].join(", "));
}
export type Environment = ReturnType<typeof parseEnv>;
export type AuthEnvironment = Exclude<Environment, { APP_KIND: "public" }>;
