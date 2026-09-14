import { getEnv } from "@/config/env";
import { getSession } from "@/server/auth";
import { privateJson, requestId } from "@/server/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = requestId(request);
  if (getEnv().APP_KIND === "public") return privateJson({ error: "not_found" }, 404, id);
  const session = await getSession();
  return session ? privateJson(session, 200, id) : privateJson({ error: "unauthorized" }, 401, id);
}
