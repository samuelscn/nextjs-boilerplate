import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@ginga/ui";
import { getEnv } from "@/config/env";
import { requireSession } from "@/server/auth";
import { LogoutButton } from "@/components/auth/logout-button";
export default async function AppPage() {
  if (getEnv().APP_KIND !== "app") notFound();
  await requireSession("/app");
  const t = await getTranslations("auth");
  return <main id="main-content" tabIndex={-1} className="page stack">
    <header className="page-header"><h1>{t("applicationTitle")}</h1><LogoutButton /></header>
    <Card><CardContent><p>{t("applicationDescription")}</p></CardContent></Card>
  </main>;
}
