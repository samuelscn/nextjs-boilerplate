import type { Metadata } from "next";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { parseTheme, themeCookie } from "@/lib/theme";
import { IntlProvider } from "@/i18n/client-provider";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getEnv } from "@/config/env";
import { LocaleSwitcher } from "@/components/locale-switcher";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  const locale = await getLocale();
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: env.APP_NAME, template: "%s | " + env.APP_NAME },
    description: t("metadataDescription"),
    openGraph: { type: "website", locale: locale.replace("-", "_"), siteName: env.APP_NAME },
    robots: env.APP_KIND === "public" ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: "/icon.svg" },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const locale = await getLocale();
  const t = await getTranslations("common");
  const messages = await getMessages();
  const requestHeaders = await headers();
  const path = requestHeaders.get("x-ginga-path") ?? "/";
  const theme = parseTheme((await cookies()).get(themeCookie)?.value);
  return <html lang={locale} data-theme={theme} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
    {theme === "system" && <head><script nonce={requestHeaders.get("x-nonce") ?? undefined}>{"if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')"}</script></head>}
    <body>
    <a className="skip-link" href="#main-content">{t("skip")}</a>
    <IntlProvider locale={locale} messages={messages}>
      {!/^\/backoffice(?:\/|$)/u.test(path) && <LocaleSwitcher returnTo={path} />}{children}
    </IntlProvider>
  </body></html>;
}
