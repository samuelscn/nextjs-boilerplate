"use client";
import { useTranslations } from "next-intl";
import { Badge, Card, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@ginga/ui";
import type { Member, Role } from "@/lib/validation/users";
import { roleLabel } from "./labels";
import { MemberActions, MemberAvatar, MemberStatus, memberRoles, useLastAccess } from "./member-parts";

// Desktop view (lg+): at md the sidebar leaves ~450px, too narrow for the columns. Mobile uses UsersList (skill list-layout: "localizar e agir" → compact list).
// `roles` is empty when the user cannot read roles (role:read): the roles column is hidden.
export function UsersTable({ members, roles }: { members: Member[]; roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  const lastAccess = useLastAccess();
  return <Card className="gap-0 overflow-hidden py-0">
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
        const assigned = memberRoles(member, roles);
        return <TableRow key={member.id}>
          <TableCell className="px-4 py-3"><div className="flex items-center gap-3">
            <MemberAvatar member={member} />
            <div className="min-w-0">
              {member.displayName && <p className="truncate font-medium">{member.displayName}</p>}
              <p className={member.displayName ? "truncate text-muted-foreground" : "truncate font-medium"}>{member.email}</p>
            </div>
          </div></TableCell>
          {roles.length > 0 && <TableCell className="px-4 py-3"><div className="flex flex-wrap gap-1">
            {assigned.length ? assigned.map(role => <Badge key={role.id} variant="outline">{roleLabel(role, tRoles)}</Badge>)
              : <span className="text-muted-foreground">{t("table.noRoles")}</span>}
          </div></TableCell>}
          <TableCell className="px-4 py-3"><MemberStatus member={member} /></TableCell>
          <TableCell className="px-4 py-3 text-muted-foreground">{lastAccess(member)}</TableCell>
          <TableCell className="px-4 py-3 text-right"><MemberActions member={member} roles={roles} /></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
  </Card>;
}
