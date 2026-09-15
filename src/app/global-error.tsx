"use client";
import { useSyncExternalStore } from "react";
import { Button } from "@ginga/ui";
import { createTranslator } from "next-intl";
import { defaultLocale, isLocale, stripLocale } from "@/i18n/config";
import { rememberedLocale } from "@/i18n/client-provider";
import { emergencyCatalogs } from "@/i18n/emergency";
import "./globals.css";

const subscribe = () => () => {};
function snapshot() {
  return stripLocale(window.location.pathname).locale ?? rememberedLocale() ??
    (isLocale(document.documentElement.lang) ? document.documentElement.lang : defaultLocale);
}
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Root provider may have failed: only public emergency messages are bundled.
  const locale = useSyncExternalStore(subscribe, snapshot, () => defaultLocale);
  const t = createTranslator({ locale, messages: emergencyCatalogs[locale] });
  return <html lang={locale}><body><main id="main-content" className="page stack"><h1>{t("common.errorTitle")}</h1>
    <p>{t("errors.INTERNAL_SERVER_ERROR")}</p><Button onClick={() => retry()}>{t("common.actions.retry")}</Button>
  </main></body></html>;
}
