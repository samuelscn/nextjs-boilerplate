import { requireSession } from "@/server/auth";
import { getEnv } from "@/config/env";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const env = getEnv();
  await requireSession(env.APP_KIND === "backoffice" ? "/backoffice" : "/app");
  return children;
}
