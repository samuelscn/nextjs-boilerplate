import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEnv } from "@/config/env";
import { ErrorState } from "@/components/feedback";
import { normalizeIdentityError } from "@/lib/http/api-error";

export default async function AuthError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (getEnv().APP_KIND === "public") notFound();
  const t = await getTranslations();
  const error = normalizeIdentityError((await searchParams).reason);
  return <main id="main-content" className="page stack"><h1>{t(error.code === "IDENTITY_UNAVAILABLE" ? "auth.unavailableTitle" : "auth.signInFailed")}</h1>
    <ErrorState error={error} /><a href="/auth/login">{t("common.actions.signIn")}</a></main>;
}
