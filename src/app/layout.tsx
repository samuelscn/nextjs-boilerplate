import type { Metadata } from "next";
import { connection } from "next/server";
import { getEnv } from "@/config/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: env.APP_NAME, template: "%s | " + env.APP_NAME },
    description: "Aplicação construída com a fundação Next.js da Ginga Software.",
    openGraph: { type: "website", locale: "pt_BR", siteName: env.APP_NAME },
    robots: env.APP_KIND === "public" ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: "/icon.svg" },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonces require dynamic rendering, including public pages.
  await connection();
  return <html lang="pt-BR"><body><a className="skip-link" href="#main-content">Pular para o conteúdo</a>{children}</body></html>;
}
