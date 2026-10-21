import type { NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { authService } from "@/server/auth";

// Renews a session the proxy did not (requireSession redirects here) and returns to the page.
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (getEnv().APP_KIND === "public") return new Response(null, { status: 404 });
  return authService().refresh(request);
}
