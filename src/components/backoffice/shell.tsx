import { useTranslations } from "next-intl";
import { ShieldCheckIcon } from "lucide-react";
import {
  Separator, Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger, TooltipProvider,
} from "@ginga/ui";
import { Navigation } from "./navigation";
import { UserMenu } from "./user-menu";

export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("backoffice");
  return <TooltipProvider><SidebarProvider>
    <Sidebar collapsible="icon" mobileTitle={t("title")} mobileDescription={t("mobileDescription")}>
      <SidebarHeader><SidebarMenu><SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={t("title")} render={<div />} className="hover:bg-transparent active:bg-transparent">
          <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheckIcon className="size-4" /></span>
          <span className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-semibold">{t("title")}</span><span className="truncate text-xs text-muted-foreground">{t("internal")}</span></span>
        </SidebarMenuButton>
      </SidebarMenuItem></SidebarMenu></SidebarHeader>
      <SidebarContent><Navigation /></SidebarContent>
      <SidebarFooter><UserMenu /></SidebarFooter>
      <SidebarRail label={t("openMenu")} />
    </Sidebar>
    <SidebarInset id="main-content" tabIndex={-1}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger label={t("openMenu")} /><Separator orientation="vertical" className="h-4" /></header>
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</div>
    </SidebarInset>
  </SidebarProvider></TooltipProvider>;
}
