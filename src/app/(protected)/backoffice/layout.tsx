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
import { Toaster } from "@ginga/ui";
import { cookies } from "next/headers";
import { parseTheme, themeCookie } from "@/lib/theme";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  if (getEnv().APP_KIND !== "backoffice") notFound();
  await requireSession("/backoffice");
  const [{ permissions }, flags, cookieStore] = await Promise.all([getAccess(), getFlags(), cookies()]);
  const theme = parseTheme(cookieStore.get(themeCookie)?.value);
  return <QueryProvider><FlagsProvider flags={flags}><AccessProvider permissions={permissions}>
    <BackofficeShell mockData={getAuthEnv().API_MODE === "mock"} theme={theme}>{children}</BackofficeShell>
    <Toaster position="top-right" theme={theme} />
  </AccessProvider></FlagsProvider></QueryProvider>;
}
