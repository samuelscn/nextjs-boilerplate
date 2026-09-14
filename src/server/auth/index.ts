import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuthEnv, getEnv } from "@/config/env";
import { createIdentityClient } from "./oidc";
import { createAuthService } from "./service";
import { sessionStore } from "../session/store";
import { internalReturnPath } from "@/lib/validation/urls";

let service: ReturnType<typeof createAuthService> | undefined;
export function authService() {
  const env = getAuthEnv();
  return service ??= createAuthService(env, sessionStore, createIdentityClient(env));
}
export async function getSession() {
  if (getEnv().APP_KIND === "public") return null;
  const auth = authService();
  return auth.getSession((await cookies()).get(auth.sessionCookie)?.value);
}
export async function requireSession(returnTo = "/app") {
  if (getEnv().APP_KIND === "public") notFound();
  const session = await getSession();
  if (!session) redirect("/auth/login?returnTo=" + encodeURIComponent(internalReturnPath(returnTo)));
  return session;
}
