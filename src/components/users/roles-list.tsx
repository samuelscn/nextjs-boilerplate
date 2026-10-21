import { useTranslations } from "next-intl";
import { KeyRoundIcon, UsersIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ginga/ui";
import type { Role } from "@/lib/validation/users";
import { roleDescription, roleLabel } from "./labels";

export function RolesList({ roles }: { roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  return <ul className="grid gap-4 sm:grid-cols-2">{roles.map(role => <li key={role.id}><Card className="h-full">
    <CardHeader><CardTitle>{roleLabel(role.id, tRoles)}</CardTitle><CardDescription>{roleDescription(role.id, tRoles)}</CardDescription></CardHeader>
    <CardContent className="flex gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5"><KeyRoundIcon aria-hidden className="size-4" />{t("rolesTab.permissions", { count: role.permissions })}</span>
      <span className="flex items-center gap-1.5"><UsersIcon aria-hidden className="size-4" />{t("rolesTab.users", { count: role.users })}</span>
    </CardContent>
  </Card></li>)}</ul>;
}
