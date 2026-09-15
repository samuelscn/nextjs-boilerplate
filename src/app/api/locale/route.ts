import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { isPublicPagePath, localeCookie, localizedPath, publicPrefix, stripLocale, supportedLocales } from "@/i18n/config";
import { HttpError } from "@/lib/http/error";
import { internalReturnPath } from "@/lib/validation/urls";
import { assertSameOrigin } from "@/server/security/csrf";
import { errorResponse, requestId } from "@/server/http";

const input = z.object({ locale: z.enum(supportedLocales), returnTo: z.string().max(2048).default("/") });
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const env = getEnv();
    assertSameOrigin(request, env.APP_URL);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") throw new HttpError(400, "VALIDATION_ERROR");
    // Bounded form body, not unbounded request.formData().
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "VALIDATION_ERROR");
    let text = "";
    const decoder = new TextDecoder();
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 4096) throw new HttpError(400, "VALIDATION_ERROR");
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const params = new URLSearchParams(text);
    if (params.getAll("locale").length !== 1 || params.getAll("returnTo").length > 1) throw new HttpError(400, "VALIDATION_ERROR");
    const parsed = input.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR");
    const path = internalReturnPath(parsed.data.returnTo, "/");
    const stripped = stripLocale(path);
    const destination = publicPrefix(env) && isPublicPagePath(stripped.path) ? localizedPath(stripped.path, parsed.data.locale) : path;
    const response = NextResponse.redirect(new URL(destination, env.APP_URL), 303);
    response.cookies.set(localeCookie, parsed.data.locale, {
      httpOnly: true, secure: env.NODE_ENV === "production" || env.APP_URL.startsWith("https:"),
      sameSite: "lax", path: "/", maxAge: 31_536_000,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return errorResponse(error, id); }
}
