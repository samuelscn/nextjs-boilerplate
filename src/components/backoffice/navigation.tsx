"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { UsersIcon } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@ginga/ui";
import { navigation } from "@/config/navigation";
import { useAccess } from "@/providers/access-provider";
import { canAny } from "@/lib/access/permissions";

const icons = { users: UsersIcon };
export function Navigation() {
  const pathname = usePathname();
  const t = useTranslations();
  const permissions = useAccess();
  const items = navigation.filter(item => !item.permission || canAny({ permissions: [...permissions] }, [item.permission]));
  return <SidebarGroup><SidebarGroupLabel>{t("backoffice.navGroup")}</SidebarGroupLabel><SidebarGroupContent>
    <nav aria-label={t("common.navigation")}><SidebarMenu>
      {items.map(item => {
        const Icon = icons[item.icon];
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return <SidebarMenuItem key={item.href}>
          <SidebarMenuButton isActive={active} tooltip={t(item.labelKey)} render={<Link href={item.href} aria-current={active ? "page" : undefined} />}>
            <Icon /><span>{t(item.labelKey)}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>;
      })}
    </SidebarMenu></nav>
  </SidebarGroupContent></SidebarGroup>;
}
