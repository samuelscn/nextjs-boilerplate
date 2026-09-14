import { Alert, AlertDescription, AlertTitle, Card, CardContent, Skeleton } from "@ginga/ui";

export function EmptyState({ title = "Nenhum conteúdo", description = "O conteúdo aparecerá aqui quando estiver disponível." }: { title?: string; description?: string }) {
  return <Card><CardContent className="stack"><h2>{title}</h2><p>{description}</p></CardContent></Card>;
}
export function ErrorState({ title = "Não foi possível carregar", description = "Tente novamente em instantes." }: { title?: string; description?: string }) {
  return <Alert variant="destructive"><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>;
}
export function LoadingState() {
  return <div role="status" aria-label="Carregando" className="stack"><p>Carregando…</p><Skeleton className="loading-block" /></div>;
}
