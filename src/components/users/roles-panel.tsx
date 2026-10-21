"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon, LockIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Badge, Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { okSchema, type PermissionCatalog, type Role } from "@/lib/validation/users";
import { useCan } from "@/providers/access-provider";
import { ErrorState } from "../feedback";
import { RoleFormDialog } from "./role-form-dialog";
import { roleDescription, roleLabel } from "./labels";

export function RolesPanel({ roles, catalog }: { roles: Role[]; catalog: PermissionCatalog }) {
  const t = useTranslations("backoffice.users.rolesTab");
  const tRoles = useTranslations("backoffice.users.roles");
  const tCommon = useTranslations("common.actions");
  const router = useRouter();
  const canCreate = useCan("role:create");
  const canUpdate = useCan("role:update");
  const canDelete = useCan("role:delete");
  const [editing, setEditing] = useState<Role | "new">();
  const [deleting, setDeleting] = useState<Role>();
  const [failure, setFailure] = useState<unknown>();
  const remove = useMutation({
    mutationFn: (role: Role) => bffRequest("/api/roles/delete", okSchema, { method: "POST", body: { id: role.id } }),
    onMutate: () => setFailure(undefined),
    onSuccess: () => { setDeleting(undefined); router.refresh(); },
    onError: error => { setDeleting(undefined); setFailure(error); },
  });
  return <div className="grid gap-4">
    {canCreate && <div className="flex justify-end"><Button onClick={() => setEditing("new")}><PlusIcon />{t("create")}</Button></div>}
    {failure !== undefined && <ErrorState error={failure} />}
    {!roles.length && <p className="text-muted-foreground">{t("empty")}</p>}
    <ul className="grid gap-4 sm:grid-cols-2">{roles.map(role => {
      const label = roleLabel(role, tRoles);
      const manageable = !role.isSystem && (canUpdate || canDelete);
      return <li key={role.id}><Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{label}{role.isSystem && <Badge variant="secondary" title={t("systemHint")}><LockIcon aria-hidden />{t("system")}</Badge>}</CardTitle>
          <CardDescription>{roleDescription(role, tRoles)}</CardDescription>
          {manageable && <CardAction><DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("actions", { role: label })} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && <DropdownMenuItem onClick={() => setEditing(role)}><PencilIcon />{t("edit")}</DropdownMenuItem>}
              {canDelete && <DropdownMenuItem variant="destructive" onClick={() => setDeleting(role)}><Trash2Icon />{t("delete")}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu></CardAction>}
        </CardHeader>
        <CardContent className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><KeyRoundIcon aria-hidden className="size-4" />{t("permissions", { count: role.permissions.length })}</span>
        </CardContent>
      </Card></li>;
    })}</ul>
    {editing !== undefined && <RoleFormDialog key={editing === "new" ? "new" : editing.id} role={editing === "new" ? undefined : editing} catalog={catalog}
      open onOpenChange={open => { if (!open) setEditing(undefined); }} />}
    <AlertDialog open={deleting !== undefined} onOpenChange={open => { if (!open && !remove.isPending) setDeleting(undefined); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{deleting && t("deleteTitle", { role: roleLabel(deleting, tRoles) })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => { if (deleting) remove.mutate(deleting); }}>
            {remove.isPending ? t("deleting") : t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
