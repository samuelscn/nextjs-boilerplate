import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ginga/ui";
import { requireSession } from "@/server/auth";
import { getAccess } from "@/server/access";
import { callContext, membersGateway } from "@/server/members";
import { can } from "@/lib/access/permissions";
import { usersQuerySchema } from "@/lib/validation/users";
import type { RawSearchParams } from "@/lib/list/params";
import { ForbiddenState } from "@/components/feedback";
import { UsersToolbar } from "@/components/users/users-toolbar";
import { UsersTable } from "@/components/users/users-table";
import { UsersList } from "@/components/users/users-list";
import { UsersEmpty } from "@/components/users/member-parts";
import { RolesPanel } from "@/components/users/roles-panel";
import { DataPagination } from "@/components/list/data-pagination";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("backoffice.users"))("title") };
}
// Reference list screen: URL state (search, multi-value filters, page), permission gate before
// any data call, mock/live gateway and the shared list components. Copy this shape for new screens.
// Responsive (skills list-layout + list-data-strategy): lg+ paginated table, below it (mobile, and tablet
// where the sidebar leaves no room for the columns) a compact list with
// infinite scroll over the same URL filters. The switch is CSS only; the mobile list fetches only on mobile.
export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireSession("/backoffice/users");
  const t = await getTranslations("backoffice.users");
  const access = await getAccess();
  if (!can(access, "member:read")) return <ForbiddenState />;
  const readRoles = can(access, "role:read");
  const query = usersQuerySchema.parse(await searchParams);
  const gateway = membersGateway();
  const context = await callContext();
  const [page, roles, catalog] = await Promise.all([
    gateway.listMembers(query, context),
    readRoles ? gateway.listRoles(context) : [],
    readRoles ? gateway.permissionCatalog(context) : { groups: [] },
  ]);
  return <div className="grid gap-6">
    <header className="grid gap-1"><h1>{t("title")}</h1><p className="text-muted-foreground">{t("description")}</p></header>
    <Tabs defaultValue="users">
      <TabsList aria-label={t("title")}><TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>{readRoles && <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>}</TabsList>
      <TabsContent value="users" className="mt-4 grid gap-4">
        <UsersToolbar query={query} roles={roles} />
        {page.total === 0 ? <UsersEmpty /> : <>
          <div className="hidden gap-4 lg:grid">
            {page.items.length ? <UsersTable members={page.items} roles={roles} /> : <UsersEmpty />}
            <DataPagination page={page.page} pageSize={page.pageSize} total={page.total} />
          </div>
          <div className="lg:hidden"><UsersList query={query} initial={page} roles={roles} /></div>
        </>}
      </TabsContent>
      {readRoles && <TabsContent value="roles" className="mt-4"><RolesPanel roles={roles} catalog={catalog} /></TabsContent>}
    </Tabs>
  </div>;
}
