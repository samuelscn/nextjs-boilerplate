"use client";
import { Button } from "@ginga/ui";
import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="pt-BR"><body><main className="page stack"><h1>Aplicação indisponível</h1><p>Tente novamente em instantes.</p><Button onClick={() => retry()}>Tentar novamente</Button></main></body></html>;
}
