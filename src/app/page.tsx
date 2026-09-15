import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@ginga/ui";
import { getEnv } from "@/config/env";
import { isLocale, localizedPath, publicPrefix, supportedLocales } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  const locale = await getLocale();
  const prefix = publicPrefix(env);
  const canonical = prefix && isLocale(locale) ? localizedPath("/", locale) : "/";
  return { alternates: { canonical,
    ...(prefix ? { languages: Object.fromEntries([...supportedLocales.map(value => [value, localizedPath("/", value)]), ["x-default", localizedPath("/", env.I18N_DEFAULT_LOCALE)]]) } : {}),
  }, openGraph: { url: canonical } };
}
export default async function HomePage() {
  const env = getEnv();
  if (env.APP_KIND !== "public") redirect(env.APP_KIND === "backoffice" ? "/backoffice" : "/app");
  const t = await getTranslations("public");
  return <main id="main-content" tabIndex={-1} className="page stack">
    <header className="page-header"><h1>{env.APP_NAME}</h1><p className="muted">{t("subtitle")}</p></header>
    <Card><CardHeader><CardTitle>{t("ready")}</CardTitle></CardHeader>
      <CardContent><p>{t("description")}</p></CardContent></Card>
  </main>;
}
