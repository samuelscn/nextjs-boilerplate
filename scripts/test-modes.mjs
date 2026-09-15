import { spawnSync } from "node:child_process";

const base = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
for (const key of Object.keys(base)) if (/^(OIDC_|SESSION_|PRODUCT_API_|APP_|I18N_)/u.test(key)) delete base[key];
for (const kind of ["app", "backoffice", "public"]) {
  const env = { ...base, APP_KIND: kind, APP_URL: "https://localhost:3440" };
  if (kind !== "public") Object.assign(env, {
    OIDC_ISSUER: "https://identity.test/api/auth", OIDC_CLIENT_ID: "build-client",
    OIDC_CLIENT_SECRET: "ginga-build-secret-canary-24f6c4f0",
    OIDC_AUDIENCE: "https://api.test", SESSION_SINGLE_PROCESS: "true",
  });
  console.log("Production build for capability: " + kind);
  const result = spawnSync("npm", ["run", "build"], { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  const security = spawnSync(process.execPath, ["scripts/security-check.mjs"], { env, stdio: "inherit" });
  if (security.status !== 0) process.exit(security.status ?? 1);
}
