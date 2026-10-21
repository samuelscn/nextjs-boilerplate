import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { themeCookie, themes } from "@/lib/theme";
import { internalReturnPath } from "@/lib/validation/urls";
import { assertSameOrigin } from "@/server/security/csrf";
import { errorResponse, readSmallForm, requestId } from "@/server/http";

const input = z.object({ theme: z.enum(themes), returnTo: z.string().max(2048).default("/") });
// Native POST form from the account menu: same-origin check, bounded body, 303 back.
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const env = getEnv();
    assertSameOrigin(request, env.APP_URL);
    const params = await readSmallForm(request);
    if (params.getAll("theme").length !== 1 || params.getAll("returnTo").length > 1) throw new HttpError(400, "VALIDATION_ERROR");
    const parsed = input.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR");
    const response = NextResponse.redirect(new URL(internalReturnPath(parsed.data.returnTo, "/"), env.APP_URL), 303);
    response.cookies.set(themeCookie, parsed.data.theme, {
      httpOnly: true, secure: env.NODE_ENV === "production" || env.APP_URL.startsWith("https:"),
      sameSite: "lax", path: "/", maxAge: 31_536_000,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return errorResponse(error, id); }
}
