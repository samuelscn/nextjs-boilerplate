import { requireSession } from "@/server/auth";
import { EmptyState } from "@/components/feedback";

export default async function BackofficePage() {
  await requireSession("/backoffice");
  return <><header className="page-header"><h1>Visão geral</h1><p className="muted">Estrutura inicial do backoffice.</p></header><EmptyState /></>;
}
