import { Separator } from "@ginga/ui";
import { Navigation } from "./navigation";
import { LogoutButton } from "../auth/logout-button";

export function BackofficeShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar"><p className="app-name">Backoffice</p><Separator /><Navigation /></aside>
    <div className="shell-content">
      <header className="shell-header"><span>Aplicação interna</span><LogoutButton /></header>
      <main id="main-content" tabIndex={-1} className="shell-main">{children}</main>
    </div>
  </div>;
}
