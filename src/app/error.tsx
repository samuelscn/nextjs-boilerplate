"use client";
import { Button } from "@ginga/ui";
import { ErrorState } from "@/components/feedback";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main id="main-content" className="page stack"><h1>Algo deu errado</h1><ErrorState /><Button onClick={() => retry()}>Tentar novamente</Button></main>;
}
