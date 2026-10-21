"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontalIcon, UserCheckIcon, UserXIcon, UsersIcon } from "lucide-react";
import {
  Avatar, AvatarFallback, Badge, Button, Card, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { memberSchema, okSchema, type Member, type Role } from "@/lib/validation/users";
import { useCan } from "@/providers/access-provider";
import { ErrorState } from "../feedback";
import { roleLabel } from "./labels";

const statusVariant = { active: "default", invited: "secondary", suspended: "outline" } as const;
const initials = (member: Member) => (member.displayName || member.email || "?").split(/[\s@.]+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

type Mutation =
  | { path: "/api/users/roles"; body: { memberId: string; roleId: string; assigned: boolean } }
  | { path: "/api/users/status"; body: { id: string; status: "active" | "suspended" } };

// `roles` is empty when the user cannot read roles (role:read): role badges and role actions are hidden.
export function UsersTable({ members, roles }: { members: Member[]; roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  const format = useFormatter();
  const router = useRouter();
  const [failure, setFailure] = useState<unknown>();
  const canAssign = useCan("role:assign") && roles.length > 0;
  const canUpdate = useCan("member:update");
  const mutate = useMutation({
    mutationFn: async (request: Mutation): Promise<void> => {
      if (request.path === "/api/users/roles") await bffRequest(request.path, okSchema, { method: "POST", body: request.body });
      else await bffRequest(request.path, memberSchema, { method: "POST", body: request.body });
    },
    onMutate: () => setFailure(undefined),
    onSuccess: () => router.refresh(),
    onError: setFailure,
  });
  const byId = new Map(roles.map(role => [role.id, role]));
  if (!members.length) return <Card className="items-center gap-2 py-16 text-center">
    <UsersIcon aria-hidden className="size-8 text-muted-foreground" />
    <h2>{t("empty.title")}</h2><p className="text-muted-foreground">{t("empty.description")}</p>
  </Card>;
  return <div className="grid gap-3">
    {failure !== undefined && <ErrorState error={failure} />}
    <Card className="gap-0 overflow-hidden py-0">
      <Table className="min-w-[44rem]">
        <TableCaption className="sr-only">{t("table.label")}</TableCaption>
        <TableHeader className="bg-muted/50"><TableRow>
          <TableHead scope="col" className="px-4">{t("table.user")}</TableHead>
          {roles.length > 0 && <TableHead scope="col" className="px-4">{t("table.roles")}</TableHead>}
          <TableHead scope="col" className="px-4">{t("table.status")}</TableHead>
          <TableHead scope="col" className="px-4">{t("table.lastAccess")}</TableHead>
          <TableHead scope="col" className="w-12 px-4"><span className="sr-only">{t("table.actions")}</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>{members.map(member => {
          const name = member.displayName || member.email || member.id;
          const memberRoles = member.roleIds.map(id => byId.get(id)).filter(role => role !== undefined);
          const statusAction = canUpdate && member.status !== "invited";
          return <TableRow key={member.id}>
            <TableCell className="px-4 py-3"><div className="flex items-center gap-3">
              <Avatar className="size-8"><AvatarFallback>{initials(member)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                {member.displayName && <p className="truncate font-medium">{member.displayName}</p>}
                <p className={member.displayName ? "truncate text-muted-foreground" : "truncate font-medium"}>{member.email}</p>
              </div>
            </div></TableCell>
            {roles.length > 0 && <TableCell className="px-4 py-3"><div className="flex flex-wrap gap-1">
              {memberRoles.length ? memberRoles.map(role => <Badge key={role.id} variant="outline">{roleLabel(role, tRoles)}</Badge>)
                : <span className="text-muted-foreground">{t("table.noRoles")}</span>}
            </div></TableCell>}
            <TableCell className="px-4 py-3"><Badge variant={statusVariant[member.status]}>{t("status." + member.status)}</Badge></TableCell>
            <TableCell className="px-4 py-3 text-muted-foreground">{member.lastSeenAt ? format.relativeTime(new Date(member.lastSeenAt)) : t(member.status === "invited" ? "table.pending" : "table.never")}</TableCell>
            <TableCell className="px-4 py-3 text-right">
              {(canAssign || statusAction) && <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={mutate.isPending} aria-label={t("actions.open", { user: name })} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
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
              </DropdownMenu>}
            </TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </Card>
  </div>;
}
