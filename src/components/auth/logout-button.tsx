import { useTranslations } from "next-intl";
import { Button } from "@ginga/ui";
export function LogoutButton() {
  const t = useTranslations("common");
  // Full document navigation also discards private browser Query caches.
  return <form method="post" action="/auth/logout"><Button type="submit" variant="outline">{t("actions.signOut")}</Button></form>;
}
