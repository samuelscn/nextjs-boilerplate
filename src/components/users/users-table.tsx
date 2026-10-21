"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontalIcon, UserCheckIcon, UserXIcon, UsersIcon } from "lucide-react";
import {
  Avatar, AvatarFallback, Badge, Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { userSchema, type Role, type User } from "@/lib/validation/users";
import { ErrorState } from "../feedback";
import { roleLabel } from "./labels";

const statusVariant = { active: "default", invited: "secondary", suspended: "outline" } as const;
const initials = (user: User) => (user.name || user.email).split(/[\s@.]+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

export function UsersTable({ users, roles }: { users: User[]; roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  const format = useFormatter();
  const router = useRouter();
  const [failure, setFailure] = useState<unknown>();
  const mutate = useMutation({
    mutationFn: (request: { path: "/api/users/role" | "/api/users/status"; body: unknown }) => bffRequest(request.path, userSchema, { method: "POST", body: request.body }),
    onMutate: () => setFailure(undefined),
    onSuccess: () => router.refresh(),
    onError: setFailure,
  });
  if (!users.length) return <Card className="items-center gap-2 py-16 text-center">
    <UsersIcon aria-hidden className="size-8 text-muted-foreground" />
    <h2>{t("empty.title")}</h2><p className="text-muted-foreground">{t("empty.description")}</p>
  </Card>;
  return <div className="grid gap-3">
    {failure !== undefined && <ErrorState error={failure} />}
    <Card className="gap-0 overflow-hidden py-0">
      <Table className="min-w-[40rem]">
        <TableCaption className="sr-only">{t("table.label")}</TableCaption>
        <TableHeader className="bg-muted/50"><TableRow>
          <TableHead scope="col" className="px-4">{t("table.user")}</TableHead>
          <TableHead scope="col" className="px-4">{t("table.role")}</TableHead>
          <TableHead scope="col" className="px-4">{t("table.status")}</TableHead>
          <TableHead scope="col" className="px-4">{t("table.lastAccess")}</TableHead>
          <TableHead scope="col" className="w-12 px-4"><span className="sr-only">{t("table.actions")}</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>{users.map(user => {
          const name = user.name || user.email;
          return <TableRow key={user.id}>
            <TableCell className="px-4 py-3"><div className="flex items-center gap-3">
              <Avatar className="size-8"><AvatarFallback>{initials(user)}</AvatarFallback></Avatar>
              <div className="min-w-0">{user.name && <p className="truncate font-medium">{user.name}</p>}<p className={user.name ? "truncate text-muted-foreground" : "truncate font-medium"}>{user.email}</p></div>
            </div></TableCell>
            <TableCell className="px-4 py-3">{roleLabel(user.roleId, tRoles)}</TableCell>
            <TableCell className="px-4 py-3"><Badge variant={statusVariant[user.status]}>{t("status." + user.status)}</Badge></TableCell>
            <TableCell className="px-4 py-3 text-muted-foreground">{user.lastAccessAt ? format.relativeTime(new Date(user.lastAccessAt)) : t(user.status === "invited" ? "table.pending" : "table.never")}</TableCell>
            <TableCell className="px-4 py-3 text-right">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={mutate.isPending} aria-label={t("actions.open", { user: name })} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("actions.changeRole")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={user.roleId} onValueChange={roleId => { if (roleId !== user.roleId) mutate.mutate({ path: "/api/users/role", body: { id: user.id, roleId } }); }}>
                      {roles.map(role => <DropdownMenuRadioItem key={role.id} value={role.id}>{roleLabel(role.id, tRoles)}</DropdownMenuRadioItem>)}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  {user.status !== "invited" && <><DropdownMenuSeparator />
                    <DropdownMenuItem variant={user.status === "suspended" ? "default" : "destructive"}
                      onClick={() => mutate.mutate({ path: "/api/users/status", body: { id: user.id, status: user.status === "suspended" ? "active" : "suspended" } })}>
                      {user.status === "suspended" ? <UserCheckIcon /> : <UserXIcon />}{t(user.status === "suspended" ? "actions.reactivate" : "actions.suspend")}
                    </DropdownMenuItem></>}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </Card>
  </div>;
}
