import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@ginga/ui";
import { getEnv } from "@/config/env";

export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };
export default function HomePage() {
  const env = getEnv();
  if (env.APP_KIND !== "public") redirect(env.APP_KIND === "backoffice" ? "/backoffice" : "/app");
  return <main id="main-content" tabIndex={-1} className="page stack">
    <header className="page-header"><h1>{env.APP_NAME}</h1><p className="muted">Fundação para sua próxima aplicação.</p></header>
    <Card><CardHeader><CardTitle>Pronto para começar</CardTitle></CardHeader>
      <CardContent><p>Personalize esta página e os tokens visuais para o seu projeto.</p></CardContent></Card>
  </main>;
}
