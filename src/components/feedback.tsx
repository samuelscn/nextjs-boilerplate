import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, Skeleton } from "@ginga/ui";
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
export function LoadingState() {
  const t = useTranslations("common");
  return <div role="status" aria-label={t("loading")} className="stack"><p>{t("loadingText")}</p><Skeleton className="loading-block" /></div>;
}
