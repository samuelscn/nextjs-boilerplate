"use client";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { MoreHorizontalIcon, UserCheckIcon, UserXIcon, UsersIcon } from "lucide-react";
import {
  Avatar, AvatarFallback, Badge, Button, Card, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { memberSchema, okSchema, type Member, type MemberPage, type Role } from "@/lib/validation/users";
import { useCan } from "@/providers/access-provider";
import { useNotify } from "@/hooks/use-notify";
import { roleLabel } from "./labels";

// Presentation shared by the desktop table and the mobile list, so formatting and actions exist once.
export const MEMBERS_QUERY_KEY = "members";
const statusVariant = { active: "default", invited: "secondary", suspended: "outline" } as const;
const initials = (member: Member) => (member.displayName || member.email || "?").split(/[\s@.]+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
export const memberName = (member: Member) => member.displayName || member.email || member.id;

export function MemberAvatar({ member }: { member: Member }) {
  return <Avatar className="size-8"><AvatarFallback>{initials(member)}</AvatarFallback></Avatar>;
}
export function MemberStatus({ member }: { member: Member }) {
  const t = useTranslations("backoffice.users");
  return <Badge variant={statusVariant[member.status]}>{t("status." + member.status)}</Badge>;
}
export function useLastAccess() {
  const t = useTranslations("backoffice.users");
  const format = useFormatter();
  return (member: Member) => member.lastSeenAt ? format.relativeTime(new Date(member.lastSeenAt)) : t(member.status === "invited" ? "table.pending" : "table.never");
}
export function memberRoles(member: Member, roles: Role[]) {
  const byId = new Map(roles.map(role => [role.id, role]));
  return member.roleIds.map(id => byId.get(id)).filter(role => role !== undefined);
}

export function UsersEmpty() {
  const t = useTranslations("backoffice.users");
  return <Card className="items-center gap-2 py-16 text-center">
    <UsersIcon aria-hidden className="size-8 text-muted-foreground" />
    <h2>{t("empty.title")}</h2><p className="text-muted-foreground">{t("empty.description")}</p>
  </Card>;
}

type Mutation =
  | { path: "/api/users/roles"; body: { memberId: string; roleId: string; assigned: boolean } }
  | { path: "/api/users/status"; body: { id: string; status: "active" | "suspended" } };

// `roles` is empty when the user cannot read roles (role:read): role actions are hidden.
// After a change the server page is refreshed (desktop) and the changed member is patched in the loaded
// infinite pages (mobile) instead of refetching every page; it stays in place even if it no longer matches a filter.
export function MemberActions({ member, roles, className }: { member: Member; roles: Role[]; className?: string }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const canAssign = useCan("role:assign") && roles.length > 0;
  const statusAction = useCan("member:update") && member.status !== "invited";
  const mutate = useMutation({
    mutationFn: async (request: Mutation): Promise<Member> => {
      if (request.path === "/api/users/status") return bffRequest(request.path, memberSchema, { method: "POST", body: request.body });
      await bffRequest(request.path, okSchema, { method: "POST", body: request.body });
      const { roleId, assigned } = request.body;
      return { ...member, roleIds: assigned ? [...new Set([...member.roleIds, roleId])] : member.roleIds.filter(id => id !== roleId) };
    },
    onSuccess: (updated, request) => {
      notify.success(request.path === "/api/users/roles" ? "backoffice.users.actions.rolesChanged" : "backoffice.users.actions.statusChanged");
      router.refresh();
      queryClient.setQueriesData<InfiniteData<MemberPage>>({ queryKey: [MEMBERS_QUERY_KEY] }, data => data && {
        ...data, pages: data.pages.map(page => ({ ...page, items: page.items.map(item => item.id === updated.id ? updated : item) })),
      });
    },
    onError: notify.error,
  });
  if (!canAssign && !statusAction) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={className} disabled={mutate.isPending} aria-label={t("actions.open", { user: memberName(member) })} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-56">
      {canAssign && <DropdownMenuGroup>
        <DropdownMenuLabel>{t("actions.roles")}</DropdownMenuLabel>
        {roles.map(role => <DropdownMenuCheckboxItem key={role.id} checked={member.roleIds.includes(role.id)}
          onCheckedChange={assigned => mutate.mutate({ path: "/api/users/roles", body: { memberId: member.id, roleId: role.id, assigned } })}>
          {roleLabel(role, tRoles)}
        </DropdownMenuCheckboxItem>)}
      </DropdownMenuGroup>}
      {statusAction && <>{canAssign && <DropdownMenuSeparator />}
        <DropdownMenuItem variant={member.status === "suspended" ? "default" : "destructive"}
          onClick={() => mutate.mutate({ path: "/api/users/status", body: { id: member.id, status: member.status === "suspended" ? "active" : "suspended" } })}>
          {member.status === "suspended" ? <UserCheckIcon /> : <UserXIcon />}{t(member.status === "suspended" ? "actions.reactivate" : "actions.suspend")}
        </DropdownMenuItem></>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
