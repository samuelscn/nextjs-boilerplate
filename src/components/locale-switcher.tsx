import { useLocale, useTranslations } from "next-intl";
import { Button, Field, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ginga/ui";
import { localeNames, supportedLocales } from "@/i18n/config";

export function LocaleSwitcher({ returnTo = "/" }: { returnTo?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  return <form method="post" action="/api/locale" className="flex flex-wrap items-center justify-end gap-3 p-4">
    <input type="hidden" name="returnTo" value={returnTo} />
    <Field orientation="horizontal" className="w-full sm:w-auto">
      <FieldLabel htmlFor="locale-switcher">{t("language")}</FieldLabel>
      <Select name="locale" defaultValue={locale}>
        <SelectTrigger id="locale-switcher" aria-label={t("language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedLocales.map(value => <SelectItem value={value} key={value}>{localeNames[value]}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
    <Button type="submit" variant="outline">{t("actions.applyLanguage")}</Button>
  </form>;
}
