import Link from "next/link";
import { ErrorState } from "@/components/feedback";
export default function NotFound() {
  return <main id="main-content" className="page stack"><h1>Página não encontrada</h1><ErrorState title="404" description="O endereço solicitado não está disponível." /><Link href="/">Ir para o início</Link></main>;
}
