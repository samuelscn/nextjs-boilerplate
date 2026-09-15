import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ErrorState } from "@/components/feedback";
import { getEnv } from "@/config/env";
import { isLocale, localizedPath, publicPrefix } from "@/i18n/config";
export default async function NotFound() {
  const t = await getTranslations();
  const locale = await getLocale();
  const home = publicPrefix(getEnv()) && isLocale(locale) ? localizedPath("/", locale) : "/";
  return <main id="main-content" className="page stack"><h1>{t("common.notFoundTitle")}</h1>
    <ErrorState title="404" description={t("errors.RESOURCE_NOT_FOUND")} /><Link href={home}>{t("common.actions.home")}</Link></main>;
}
