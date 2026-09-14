import { notFound } from "next/navigation";
import { Card, CardContent } from "@ginga/ui";
import { getEnv } from "@/config/env";
import { requireSession } from "@/server/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AppPage() {
  if (getEnv().APP_KIND !== "app") notFound();
  await requireSession("/app");
  return <main id="main-content" tabIndex={-1} className="page stack">
    <header className="page-header"><h1>Authenticated application</h1><LogoutButton /></header>
    <Card><CardContent><p>Sessão autenticada. Adicione aqui as funcionalidades do produto.</p></CardContent></Card>
  </main>;
}
