"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, Button, Card, Skeleton } from "@ginga/ui";
import { memberPageSchema, type MemberPage, type Role, type UsersQuery } from "@/lib/validation/users";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LoadMore } from "../list/load-more";
import { roleLabel } from "./labels";
import { MEMBERS_QUERY_KEY, MemberActions, MemberAvatar, MemberStatus, memberName, memberRoles, useLastAccess } from "./member-parts";

// Mobile/tablet view (< lg). list-layout: "localizar e agir" → compact list; priority fields are name/email and
// status, secondary are roles and last access (one muted line), actions stay in the same menu as the table.
// list-data-strategy: infinite scroll with the same URL filters as the table, conventional rendering
// (a members list rarely accumulates hundreds of rows; add virtualization when it does).
export function UsersList({ query, initial, roles }: { query: UsersQuery; initial: MemberPage; roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tRoles = useTranslations("backoffice.users.roles");
  const lastAccess = useLastAccess();
  const mobile = useMediaQuery("(width < 64rem)");
  const list = useInfiniteList({ key: MEMBERS_QUERY_KEY, path: "/api/users", schema: memberPageSchema, query, initial, enabled: mobile });
  const { fetchNextPage } = list;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  if (!list.data) return list.isError
    ? <Alert variant="destructive"><AlertDescription className="grid gap-2">{t("list.error")}<Button variant="outline" onClick={() => void list.refetch()}>{t("list.retry")}</Button></AlertDescription></Alert>
    : <div role="status" aria-label={t("list.loading")} className="grid gap-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-16" />)}</div>;
  return <div className="grid gap-3">
    <Card className="gap-0 py-0">
      <ul aria-label={t("table.label")} className="divide-y">{list.items.map(member => {
        const assigned = memberRoles(member, roles).map(role => roleLabel(role, tRoles)).join(", ");
        return <li key={member.id} className="flex items-center gap-3 px-4 py-3">
          <MemberAvatar member={member} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <div className="flex min-w-0 items-center gap-2"><p className="truncate font-medium">{memberName(member)}</p><MemberStatus member={member} /></div>
            {member.displayName && member.email && <p className="truncate text-sm text-muted-foreground">{member.email}</p>}
            <p className="truncate text-xs text-muted-foreground">
              {roles.length > 0 && <>{assigned || t("table.noRoles")} · </>}{lastAccess(member)}
            </p>
          </div>
          <MemberActions member={member} roles={roles} className="size-11" />
        </li>;
      })}</ul>
    </Card>
    <LoadMore loaded={list.items.length} total={list.total} hasNextPage={list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage}
      isError={list.isFetchNextPageError} onLoadMore={loadMore} />
  </div>;
}
