"use client";
import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { Button } from "@ginga/ui";
import { memberStatuses, type Role, type UsersQuery } from "@/lib/validation/users";
import { useListParams } from "@/hooks/use-list-params";
import { SearchInput } from "../list/search-input";
import { MultiSelectFilter } from "../list/multi-select-filter";
import { InviteUserDialog } from "./invite-user-dialog";
import { Can } from "../access/can";
import { roleLabel } from "./labels";

export function UsersToolbar({ query, roles }: { query: UsersQuery; roles: Role[] }) {
  const t = useTranslations("backoffice.users");
  const tCommon = useTranslations("common.list");
  const tRoles = useTranslations("backoffice.users.roles");
  const { update, clear, pending } = useListParams();
  const filtered = Boolean(query.q || query.role.length || query.status.length);
  const summary = (count: number) => tCommon("selected", { count });
  return <div role="search" aria-label={t("filters.label")} aria-busy={pending} className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
    <SearchInput value={query.q} label={t("filters.search")} onSearch={q => update({ q })} />
    {roles.length > 0 && <MultiSelectFilter label={t("filters.role")} placeholder={t("filters.allRoles")} className="w-full md:w-48" summary={summary}
      options={roles.map(role => ({ value: role.id, label: roleLabel(role, tRoles) }))} value={query.role} onChange={role => update({ role })} />}
    <MultiSelectFilter label={t("filters.status")} placeholder={t("filters.allStatuses")} className="w-full md:w-44" summary={summary}
      options={memberStatuses.map(status => ({ value: status, label: t("status." + status) }))} value={query.status} onChange={status => update({ status })} />
    {filtered && <Button variant="ghost" onClick={() => clear(["q", "role", "status", "page"])}><XIcon />{t("filters.clear")}</Button>}
    {roles.length > 0 && <Can permission="member:invite"><Can permission="role:assign"><div className="md:ml-auto"><InviteUserDialog roles={roles} /></div></Can></Can>}
  </div>;
}
