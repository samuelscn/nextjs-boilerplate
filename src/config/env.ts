import "server-only";
import { parseEnv, type Environment, type AuthEnvironment } from "./schema";

let cached: Environment | undefined;
export function getEnv(): Environment {
  return cached ??= parseEnv(process.env);
}
export function getAuthEnv(): AuthEnvironment {
  const env = getEnv();
  if (env.APP_KIND === "public") throw new Error("Auth capability is disabled");
  return env;
}
