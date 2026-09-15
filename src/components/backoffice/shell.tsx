import { useTranslations } from "next-intl";
import { Separator } from "@ginga/ui";
import { Navigation } from "./navigation";
import { LogoutButton } from "../auth/logout-button";
export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("backoffice");
  return <div className="app-shell">
    <aside className="sidebar"><p className="app-name">{t("title")}</p><Separator /><Navigation /></aside>
    <div className="shell-content">
      <header className="shell-header"><span>{t("internal")}</span><LogoutButton /></header>
      <main id="main-content" tabIndex={-1} className="shell-main">{children}</main>
    </div>
  </div>;
}
