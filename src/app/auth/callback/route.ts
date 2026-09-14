import type { NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { authService } from "@/server/auth";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (getEnv().APP_KIND === "public") return new Response(null, { status: 404 });
  return authService().callback(request);
}
