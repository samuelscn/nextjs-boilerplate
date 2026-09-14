import { notFound } from "next/navigation";
import { getEnv } from "@/config/env";
import { requireSession } from "@/server/auth";
import { BackofficeShell } from "@/components/backoffice/shell";
import { QueryProvider } from "@/providers/query-provider";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  if (getEnv().APP_KIND !== "backoffice") notFound();
  await requireSession("/backoffice");
  return <QueryProvider><BackofficeShell>{children}</BackofficeShell></QueryProvider>;
}
