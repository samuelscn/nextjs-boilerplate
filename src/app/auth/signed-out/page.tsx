import { notFound } from "next/navigation";
import { getEnv } from "@/config/env";

export default function SignedOut() {
  if (getEnv().APP_KIND === "public") notFound();
  return <main id="main-content" className="page stack"><h1>Sessão local encerrada</h1><p>Não foi possível confirmar o encerramento da sessão no Identity. Encerre-a na aplicação Identity.</p><a href="/auth/login">Entrar novamente</a></main>;
}
