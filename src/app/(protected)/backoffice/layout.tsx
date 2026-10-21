import { notFound } from "next/navigation";
import { getEnv } from "@/config/env";
import { requireSession } from "@/server/auth";
import { getAccess } from "@/server/access";
import { BackofficeShell } from "@/components/backoffice/shell";
import { QueryProvider } from "@/providers/query-provider";
import { AccessProvider } from "@/providers/access-provider";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  if (getEnv().APP_KIND !== "backoffice") notFound();
  await requireSession("/backoffice");
  const { permissions } = await getAccess();
  return <QueryProvider><AccessProvider permissions={permissions}><BackofficeShell>{children}</BackofficeShell></AccessProvider></QueryProvider>;
}
