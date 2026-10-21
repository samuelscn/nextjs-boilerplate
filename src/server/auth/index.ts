import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuthEnv, getEnv } from "@/config/env";
import { createIdentityClient } from "./oidc";
import { createFakeIdentityClient } from "./fake";
import { createAuthService } from "./service";
import { parseSealKeys } from "../session/seal";
import { internalReturnPath } from "@/lib/validation/urls";

let service: ReturnType<typeof createAuthService> | undefined;
export function authService() {
  const env = getAuthEnv();
  const identity = env.AUTH_PROVIDER === "fake" ? createFakeIdentityClient(env) : createIdentityClient(env);
  return service ??= createAuthService(env, parseSealKeys(env.SESSION_SECRETS), identity);
}
export async function getSession() {
  if (getEnv().APP_KIND === "public") return null;
  const auth = authService();
  return auth.getSession((await cookies()).get(auth.sessionCookie)?.value);
}
export async function requireSession(returnTo = "/app") {
  if (getEnv().APP_KIND === "public") notFound();
  const session = await getSession();
  const target = encodeURIComponent(internalReturnPath(returnTo));
  if (!session) redirect("/auth/login?returnTo=" + target);
  // The proxy renews before rendering; a stale session here escaped it, so renew where cookies can be written.
  if (session.stale) redirect("/auth/refresh?returnTo=" + target);
  return session;
}
