"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";

export function Navigation() {
  const pathname = usePathname();
  return <nav aria-label="Navegação principal"><ul className="navigation">
    {navigation.map(item => <li key={item.href}><Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link></li>)}
  </ul></nav>;
}
