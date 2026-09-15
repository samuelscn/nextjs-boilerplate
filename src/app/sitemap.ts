import type { MetadataRoute } from "next";
import { getEnv } from "@/config/env";
import { localizedPath, publicPrefix, supportedLocales } from "@/i18n/config";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const env = getEnv();
  if (env.APP_KIND !== "public") return [];
  if (!publicPrefix(env)) return [{ url: env.APP_URL + "/" }];
  const languages = Object.fromEntries(supportedLocales.map(locale => [locale, env.APP_URL + localizedPath("/", locale)]));
  return supportedLocales.map(locale => ({ url: languages[locale]!, alternates: { languages } }));
}
