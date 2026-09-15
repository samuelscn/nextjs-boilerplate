import { getTranslations } from "next-intl/server";
import { requireSession } from "@/server/auth";
import { EmptyState } from "@/components/feedback";
export default async function BackofficePage() {
  await requireSession("/backoffice");
  const t = await getTranslations("backoffice");
  return <><header className="page-header"><h1>{t("overview")}</h1><p className="muted">{t("description")}</p></header><EmptyState /></>;
}
