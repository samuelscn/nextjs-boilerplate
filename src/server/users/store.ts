import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http/error";
import type { User, UsersPage, UsersQuery } from "@/lib/validation/users";

// Reference adapter. Roles and users belong to the Product API (never to Identity or the token):
// replace this module with a productRequest()-backed implementation exposing the same contract.
export const roleDefinitions = [
  { id: "admin", permissions: 24 }, { id: "manager", permissions: 14 },
  { id: "support", permissions: 8 }, { id: "viewer", permissions: 3 },
] as const;
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
function seed(): User[] {
  return [
    { name: "Helena Duarte", email: "helena.duarte@example.com", roleId: "admin", status: "active", lastAccessAt: ago(0) },
    { name: "Rafael Moreira", email: "rafael.moreira@example.com", roleId: "manager", status: "active", lastAccessAt: ago(1) },
    { name: "Camila Torres", email: "camila.torres@example.com", roleId: "support", status: "active", lastAccessAt: ago(2) },
    { name: "Bruno Azevedo", email: "bruno.azevedo@example.com", roleId: "viewer", status: "active", lastAccessAt: ago(6) },
    { name: "Lívia Prado", email: "livia.prado@example.com", roleId: "manager", status: "suspended", lastAccessAt: ago(41) },
    { name: "Diego Ferraz", email: "diego.ferraz@example.com", roleId: "support", status: "active", lastAccessAt: ago(3) },
    { name: "", email: "marina.lopes@example.com", roleId: "viewer", status: "invited", lastAccessAt: null },
    { name: "Tiago Nogueira", email: "tiago.nogueira@example.com", roleId: "viewer", status: "suspended", lastAccessAt: ago(90) },
  ].map(user => ({ ...user, id: randomUUID() })) as User[];
}

export function createUsersStore(initial: User[] = seed()) {
  const users = [...initial];
  const roleExists = (id: string) => roleDefinitions.some(role => role.id === id);
  const find = (id: string) => users.find(user => user.id === id) ?? (() => { throw new HttpError(404, "RESOURCE_NOT_FOUND"); })();
  return {
    list(query: UsersQuery): UsersPage {
      const needle = query.q.toLowerCase();
      const matches = users.filter(user =>
        (!needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)) &&
        (!query.role.length || query.role.includes(user.roleId)) && (!query.status.length || query.status.includes(user.status)));
      // An out-of-range page (stale link, shrunk result) is clamped to the last page.
      const pageCount = Math.max(1, Math.ceil(matches.length / query.pageSize));
      const page = Math.min(query.page, pageCount);
      return {
        users: matches.slice((page - 1) * query.pageSize, page * query.pageSize).map(user => ({ ...user })), total: matches.length, page, pageSize: query.pageSize, pageCount,
        roles: roleDefinitions.map(role => ({ ...role, users: users.filter(user => user.roleId === role.id).length })),
      };
    },
    invite(input: { email: string; roleId: string }): User {
      if (!roleExists(input.roleId)) throw new HttpError(400, "VALIDATION_ERROR");
      if (users.some(user => user.email.toLowerCase() === input.email.toLowerCase())) throw new HttpError(409, "RESOURCE_CONFLICT");
      const user: User = { id: randomUUID(), name: "", email: input.email, roleId: input.roleId, status: "invited", lastAccessAt: null };
      users.unshift(user);
      return { ...user };
    },
    changeRole(input: { id: string; roleId: string }): User {
      if (!roleExists(input.roleId)) throw new HttpError(400, "VALIDATION_ERROR");
      const user = find(input.id);
      user.roleId = input.roleId;
      return { ...user };
    },
    changeStatus(input: { id: string; status: "active" | "suspended" }): User {
      const user = find(input.id);
      if (user.status === "invited") throw new HttpError(422, "DOMAIN_RULE_VIOLATION");
      user.status = input.status;
      return { ...user };
    },
  };
}
const runtime = globalThis as typeof globalThis & { gingaUsersStore?: ReturnType<typeof createUsersStore> };
export const usersStore = runtime.gingaUsersStore ??= createUsersStore();
