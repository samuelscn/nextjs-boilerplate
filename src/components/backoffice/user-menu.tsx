"use client";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, GlobeIcon, LogOutIcon, PaletteIcon, UserRoundIcon } from "lucide-react";
import { themes, type Theme } from "@/lib/theme";
import {
  Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@ginga/ui";
import { localeNames, supportedLocales } from "@/i18n/config";

// Account, language and sign-out live together in the sidebar footer. Both actions stay native POST forms
// (CSRF/origin checks and a full document navigation), so the menu needs no client state of its own.
export function UserMenu({ theme }: { theme: Theme }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  return <SidebarMenu><SidebarMenuItem><DropdownMenu>
    <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={t("backoffice.account")} className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground" />}>
      <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg"><UserRoundIcon className="size-4" /></AvatarFallback></Avatar>
      <span className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{t("backoffice.account")}</span></span>
      <ChevronsUpDownIcon className="ml-auto size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="min-w-56">
      <form method="post" action="/api/locale">
        <input type="hidden" name="returnTo" value={pathname} />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2"><GlobeIcon className="size-4" />{t("backoffice.language")}</DropdownMenuLabel>
          {supportedLocales.map(value => <DropdownMenuItem key={value} nativeButton render={<button type="submit" name="locale" value={value} lang={value} />}>
            <span className="flex-1 text-left">{localeNames[value]}</span>
            {value === locale && <CheckIcon className="size-4" aria-label="✓" />}
          </DropdownMenuItem>)}
        </DropdownMenuGroup>
      </form>
      <DropdownMenuSeparator />
      <form method="post" action="/api/theme">
        <input type="hidden" name="returnTo" value={pathname} />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2"><PaletteIcon className="size-4" />{t("backoffice.theme.label")}</DropdownMenuLabel>
          {themes.map(value => <DropdownMenuItem key={value} nativeButton render={<button type="submit" name="theme" value={value} aria-current={value === theme ? "true" : undefined} />}>
            <span className="flex-1 text-left">{t("backoffice.theme." + value)}</span>
            {value === theme && <CheckIcon className="size-4" aria-hidden />}
          </DropdownMenuItem>)}
        </DropdownMenuGroup>
      </form>
      <DropdownMenuSeparator />
      <form method="post" action="/auth/logout">
        <DropdownMenuItem nativeButton render={<button type="submit" />}><LogOutIcon />{t("common.actions.signOut")}</DropdownMenuItem>
      </form>
    </DropdownMenuContent>
  </DropdownMenu></SidebarMenuItem></SidebarMenu>;
}
