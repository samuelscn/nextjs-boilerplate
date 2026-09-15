"use client";
import { useEffect } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { isLocale, type Locale } from "./config";

let lastLocale: Locale | undefined;
export function rememberedLocale() { return lastLocale; }
export function IntlProvider({ locale, messages, children }: { locale: string; messages: AbstractIntlMessages; children: React.ReactNode }) {
  useEffect(() => { if (isLocale(locale)) lastLocale = locale; }, [locale]);
  return <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC"
    onError={() => { /* No client logging of interpolation values or error payloads. */ }}
    getMessageFallback={() => String((messages.errors as Record<string, string>).INTERNAL_SERVER_ERROR)}>
    {children}
  </NextIntlClientProvider>;
}
