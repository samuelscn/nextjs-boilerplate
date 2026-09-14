import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "./config/env";
import { securityHeaders } from "./lib/security/headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(32).toString("base64");
  const env = getEnv();
  const headers = securityHeaders(nonce, env.NODE_ENV === "production", env.APP_KIND === "public" ? undefined : new URL(env.OIDC_ISSUER).origin);
  const forwarded = new Headers(request.headers);
  // Overwrite caller-supplied correlation/security headers.
  forwarded.set("x-request-id", randomUUID());
  forwarded.set("x-nonce", nonce);
  forwarded.set("Content-Security-Policy", headers["Content-Security-Policy"]!);
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  response.headers.set("x-request-id", forwarded.get("x-request-id")!);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
