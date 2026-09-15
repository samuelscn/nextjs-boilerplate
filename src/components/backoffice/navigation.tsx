"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
export function Navigation() {
  const pathname = usePathname();
  const t = useTranslations();
  return <nav aria-label={t("common.navigation")}><ul className="navigation">
    {navigation.map(item => <li key={item.href}><Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{t(item.labelKey)}</Link></li>)}
  </ul></nav>;
}
