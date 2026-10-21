import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEnv } from "@/config/env";
import { FAKE_USERS } from "@/server/auth/fake";

// Development-only sign-in page of the fake Identity (AUTH_PROVIDER=fake). It answers like the Identity:
// back to /auth/callback with a code, the transaction state and the issuer, so the real callback validates it.
export default async function FakeSignIn({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  const env = getEnv();
  if (env.APP_KIND === "public" || env.AUTH_PROVIDER !== "fake") notFound();
  const t = await getTranslations("auth.fake");
  const { state } = await searchParams;
  if (typeof state !== "string" || !state || state.length > 256) notFound();
  const href = (code: string) => "/auth/callback?" + new URLSearchParams({ code, state, iss: env.OIDC_ISSUER });
  return <main id="main-content" className="page stack">
    <h1>{t("title")}</h1>
    <p>{t("description")}</p>
    <ul className="stack">
      {FAKE_USERS.map(user => <li key={user.key}><a href={href(user.key)}>{t(`users.${user.key}`)}</a> <code>{user.subject}</code></li>)}
    </ul>
  </main>;
}
