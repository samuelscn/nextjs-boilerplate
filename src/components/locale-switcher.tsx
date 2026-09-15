import { useLocale, useTranslations } from "next-intl";
import { Button } from "@ginga/ui";
import { localeNames, supportedLocales } from "@/i18n/config";

export function LocaleSwitcher({ returnTo = "/" }: { returnTo?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  return <form method="post" action="/api/locale" className="locale-switcher">
    <input type="hidden" name="returnTo" value={returnTo} />
    <label>{t("language")} <select name="locale" defaultValue={locale}>
      {supportedLocales.map(value => <option value={value} key={value}>{localeNames[value]}</option>)}
    </select></label>
    <Button type="submit" variant="outline">{t("actions.applyLanguage")}</Button>
  </form>;
}
