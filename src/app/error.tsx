"use client";
import { useTranslations } from "next-intl";
import { Button } from "@ginga/ui";
import { ErrorState } from "@/components/feedback";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("common");
  return <main id="main-content" className="page stack"><h1>{t("errorTitle")}</h1><ErrorState /><Button onClick={() => retry()}>{t("actions.retry")}</Button></main>;
}
