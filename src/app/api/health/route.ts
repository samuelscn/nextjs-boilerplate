import { getEnv } from "@/config/env";

// Liveness only. Outside production it also reports the data mode and resolved flags,
// which helps agents and developers confirm the running configuration.
export function GET() {
  const env = getEnv();
  const details = env.NODE_ENV === "production" ? {} : { apiMode: env.APP_KIND === "public" ? null : env.API_MODE, flags: env.flags };
  return Response.json({ status: "ok", ...details }, { headers: { "Cache-Control": "no-store" } });
}
