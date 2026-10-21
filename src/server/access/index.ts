import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { getAuthEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { can, type Access, type Permission } from "@/lib/access/permissions";
import { getSession } from "../auth";
import { productRequest } from "../api/product";
import { myAccessSchema } from "./catalog";
import { mockAccess } from "./mock";

// Effective access of the current user, resolved once per request (React cache, never global).
export const getAccess = cache(async (): Promise<Access> => {
  const session = await getSession();
  if (!session) throw new HttpError(401, "AUTHENTICATION_REQUIRED");
  const env = getAuthEnv();
  if (env.API_MODE === "mock") return mockAccess(session.user.id, env.API_MOCK_PERMISSIONS);
  return productRequest("/access/me", myAccessSchema, { requestId: randomUUID() });
});

export async function hasPermission(permission: Permission) {
  return can(await getAccess(), permission);
}

// BFF guard: re-check before calling the API so the UI cannot be bypassed into extra calls.
export async function assertPermission(permission: Permission) {
  if (!await hasPermission(permission)) throw new HttpError(403, "AUTHORIZATION_FORBIDDEN");
}
