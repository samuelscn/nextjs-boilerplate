import { notFound } from "next/navigation";
import { getEnv } from "@/config/env";
import { ErrorState } from "@/components/feedback";

export default async function AuthError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (getEnv().APP_KIND === "public") notFound();
  const unavailable = (await searchParams).reason === "unavailable";
  return <main id="main-content" className="page stack"><h1>{unavailable ? "Identity indisponível" : "Não foi possível entrar"}</h1>
    <ErrorState description={unavailable ? "Tente novamente em instantes." : "O fluxo expirou ou não pôde ser validado. Inicie um novo acesso."} />
    <a href="/auth/login">Iniciar novo acesso</a></main>;
}
