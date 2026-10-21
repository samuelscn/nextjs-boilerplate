import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ginga/ui";
import { requireSession } from "@/server/auth";
import { usersStore } from "@/server/users/store";
import { usersQuerySchema } from "@/lib/validation/users";
import type { RawSearchParams } from "@/lib/list/params";
import { UsersToolbar } from "@/components/users/users-toolbar";
import { UsersTable } from "@/components/users/users-table";
import { RolesList } from "@/components/users/roles-list";
import { DataPagination } from "@/components/list/data-pagination";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("backoffice.users"))("title") };
}
export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireSession("/backoffice/users");
  const t = await getTranslations("backoffice.users");
  const query = usersQuerySchema.parse(await searchParams);
  const { users, roles, total, page, pageSize } = usersStore.list(query);
  return <div className="grid gap-6">
    <header className="grid gap-1"><h1>{t("title")}</h1><p className="text-muted-foreground">{t("description")}</p></header>
    <Tabs defaultValue="users">
      <TabsList aria-label={t("title")}><TabsTrigger value="users">{t("tabs.users")}</TabsTrigger><TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger></TabsList>
      <TabsContent value="users" className="mt-4 grid gap-4">
        <UsersToolbar query={query} roles={roles} />
        <UsersTable users={users} roles={roles} />
        {total > 0 && <DataPagination page={page} pageSize={pageSize} total={total} />}
      </TabsContent>
      <TabsContent value="roles" className="mt-4"><RolesList roles={roles} /></TabsContent>
    </Tabs>
  </div>;
}
