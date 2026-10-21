import { useTranslations } from "next-intl";
import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, buttonVariants, Card, CardContent, Skeleton } from "@ginga/ui";
import { localizedError, errorAction } from "@/i18n/errors";
import { normalizeFrontendError } from "@/lib/http/api-error";

export function EmptyState({ title, description }: { title?: string; description?: string }) {
  const t = useTranslations("common");
  return <Card><CardContent className="stack"><h2>{title ?? t("emptyTitle")}</h2><p>{description ?? t("emptyDescription")}</p></CardContent></Card>;
}
export function ErrorState({ title, description, error }: { title?: string; description?: string; error?: unknown }) {
  const t = useTranslations();
  const normalized = normalizeFrontendError(error);
  return <Alert variant="destructive"><AlertTitle>{title ?? t("common.errorTitle")}</AlertTitle>
    <AlertDescription>{description ?? localizedError(normalized, t)}
      {normalized.requestId && <p>{t("common.reference", { id: normalized.requestId })}</p>}
      {errorAction(normalized) === "login" && <a href="/auth/login">{t("common.actions.signIn")}</a>}
    </AlertDescription></Alert>;
}
// 403 for pages and sections: never redirects to login (the session is valid) and never retries.
export function ForbiddenState({ backHref }: { backHref?: string }) {
  const t = useTranslations("common.forbidden");
  return <Card className="items-center gap-3 py-16 text-center">
    <ShieldXIcon aria-hidden className="size-8 text-muted-foreground" />
    <h2>{t("title")}</h2>
    <p className="max-w-md text-muted-foreground">{t("description")}</p>
    {backHref && <Link href={backHref} className={buttonVariants({ variant: "outline" })}>{t("back")}</Link>}
  </Card>;
}
export function LoadingState() {
  const t = useTranslations("common");
  return <div role="status" aria-label={t("loading")} className="stack"><p>{t("loadingText")}</p><Skeleton className="loading-block" /></div>;
}
