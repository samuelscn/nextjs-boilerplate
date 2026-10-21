import { getEnv } from "@/config/env";
import { getSession } from "@/server/auth";
import { errorResponse, privateJson, requestId } from "@/server/http";
import { HttpError } from "@/lib/http/error";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = requestId(request);
  if (getEnv().APP_KIND === "public") return errorResponse(new HttpError(404, "RESOURCE_NOT_FOUND"), id);
  const session = await getSession();
  // Public contract: { user: { id }, expiresAt } only; `stale` is internal to rendering.
  return session ? privateJson({ user: session.user, expiresAt: session.expiresAt }, 200, id) : errorResponse(new HttpError(401, "AUTHENTICATION_REQUIRED"), id);
}
