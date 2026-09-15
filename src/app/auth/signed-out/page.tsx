import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEnv } from "@/config/env";
export default async function SignedOut() {
  if (getEnv().APP_KIND === "public") notFound();
  const t = await getTranslations();
  return <main id="main-content" className="page stack"><h1>{t("auth.signedOutTitle")}</h1><p>{t("auth.signedOutDescription")}</p><a href="/auth/login">{t("common.actions.signIn")}</a></main>;
}
