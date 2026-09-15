import "server-only";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getEnv } from "../config/env";
import { catalogs } from "./catalogs";
import { localeCookie, resolveLocale } from "./config";

export default getRequestConfig(async () => {
  const env = getEnv();
  const incoming = await headers();
  const locale = resolveLocale({
    explicit: incoming.get("x-ginga-locale"),
    cookie: (await cookies()).get(localeCookie)?.value,
    acceptLanguage: incoming.get("accept-language"),
    fallback: env.I18N_DEFAULT_LOCALE,
  });
  return { locale, messages: catalogs[locale], timeZone: "UTC",
    onError() { /* Never log messages, interpolation values or user input. Tests validate catalogs. */ },
    getMessageFallback: () => catalogs[env.I18N_DEFAULT_LOCALE].errors.INTERNAL_SERVER_ERROR,
  };
});
