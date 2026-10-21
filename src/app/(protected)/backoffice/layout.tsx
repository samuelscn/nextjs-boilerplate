import { notFound } from "next/navigation";
import { getEnv } from "@/config/env";
import { requireSession } from "@/server/auth";
import { getAccess } from "@/server/access";
import { BackofficeShell } from "@/components/backoffice/shell";
import { QueryProvider } from "@/providers/query-provider";
import { AccessProvider } from "@/providers/access-provider";
import { FlagsProvider } from "@/providers/flags-provider";
import { getFlags } from "@/server/flags";
import { getAuthEnv } from "@/config/env";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  if (getEnv().APP_KIND !== "backoffice") notFound();
  await requireSession("/backoffice");
  const [{ permissions }, flags] = await Promise.all([getAccess(), getFlags()]);
  return <QueryProvider><FlagsProvider flags={flags}><AccessProvider permissions={permissions}>
    <BackofficeShell mockData={getAuthEnv().API_MODE === "mock"}>{children}</BackofficeShell>
  </AccessProvider></FlagsProvider></QueryProvider>;
}
