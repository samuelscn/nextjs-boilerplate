import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http/error";
import type { Member, MemberStatus, Role, RoleValues } from "@/lib/validation/users";
import { PERMISSIONS } from "../access/catalog";
import type { MembersGateway } from "./gateway";

// API_MODE=mock: in-process stand-in for the Product API access endpoints. Same contract,
// same problem codes and the main invariants (system roles, last owner, self-suspension,
// pending invitations), so screens and error handling behave as in live mode.
// Single process only; data resets on restart. Refused in production by config.
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const permissionsOf = (...resources: string[]) => PERMISSIONS.filter(permission => resources.some(resource => permission === resource || permission.startsWith(resource + ":")));

type State = { roles: Role[]; members: Member[] };
function seed(): State {
  const role = (slug: string, name: string, permissions: string[], isSystem: boolean, description: string | null = null): Role =>
    ({ id: randomUUID(), slug, name, description, isSystem, permissions });
  const owner = role("owner", "OWNER", [...PERMISSIONS], true);
  const admin = role("admin", "ADMIN", [...PERMISSIONS], true);
  const member = role("member", "MEMBER", permissionsOf("example:read"), true);
  const support = role("support", "Suporte", permissionsOf("member:read", "role:read"), false, "Consulta pessoas e roles para atender solicitações.");
  const people: [string, string, Role, MemberStatus, number | null][] = [
    ["Helena Duarte", "helena.duarte@example.com", owner, "active", 0],
    ["Rafael Moreira", "rafael.moreira@example.com", admin, "active", 1],
    ["Camila Torres", "camila.torres@example.com", support, "active", 2],
    ["Bruno Azevedo", "bruno.azevedo@example.com", member, "active", 6],
    ["Lívia Prado", "livia.prado@example.com", admin, "suspended", 41],
    ["Diego Ferraz", "diego.ferraz@example.com", support, "active", 3],
    ["", "marina.lopes@example.com", member, "invited", null],
    ["Tiago Nogueira", "tiago.nogueira@example.com", member, "suspended", 90],
    ["Ana Ribeiro", "ana.ribeiro@example.com", member, "active", 4],
    ["Caio Mendes", "caio.mendes@example.com", support, "active", 9],
    ["Beatriz Lima", "beatriz.lima@example.com", member, "active", 12],
    ["", "joao.pereira@example.com", support, "invited", null],
    ["Fernanda Costa", "fernanda.costa@example.com", member, "active", 20],
    ["Gustavo Rocha", "gustavo.rocha@example.com", admin, "active", 5],
  ];
  return {
    roles: [owner, admin, member, support],
    members: people.map(([name, email, assigned, status, seen]) => ({
      id: randomUUID(), identityUserId: status === "invited" ? null : "mock_" + email.split("@")[0],
      displayName: name || null, email, status, lastSeenAt: seen === null ? null : ago(seen), roleIds: [assigned.id],
    })),
  };
}

export function createMockMembersGateway(state: State = seed()): MembersGateway {
  const role = (id: string) => state.roles.find(item => item.id === id) ?? (() => { throw new HttpError(404, "RESOURCE_NOT_FOUND"); })();
  const member = (id: string) => state.members.find(item => item.id === id) ?? (() => { throw new HttpError(404, "RESOURCE_NOT_FOUND"); })();
  const owner = () => state.roles.find(item => item.slug === "owner" && item.isSystem)!;
  const activeOwners = () => state.members.filter(item => item.status === "active" && item.roleIds.includes(owner().id)).length;
  const validRole = (input: RoleValues, id?: string) => {
    if (["owner", "admin", "member"].includes(input.slug) || input.permissions.some(permission => !PERMISSIONS.includes(permission as never))) throw new HttpError(400, "VALIDATION_ERROR");
    if (state.roles.some(item => item.slug === input.slug && item.id !== id)) throw new HttpError(409, "RESOURCE_CONFLICT");
  };
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    async listMembers(query) {
      const needle = query.q.toLowerCase();
      const matches = state.members
        .filter(item => (!needle || (item.displayName ?? "").toLowerCase().includes(needle) || (item.email ?? "").toLowerCase().includes(needle)) &&
          (!query.role.length || item.roleIds.some(id => query.role.includes(id))) && (!query.status.length || query.status.includes(item.status)))
        .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || "", "pt-BR"));
      const pageCount = Math.max(1, Math.ceil(matches.length / query.pageSize));
      const page = Math.min(query.page, pageCount);
      return { items: copy(matches.slice((page - 1) * query.pageSize, page * query.pageSize)), total: matches.length, page, pageSize: query.pageSize };
    },
    async invite({ email, roleId }) {
      role(roleId);
      const normalized = email.trim().toLowerCase();
      if (state.members.some(item => item.email === normalized)) throw new HttpError(409, "MEMBER_ALREADY_EXISTS");
      const created: Member = { id: randomUUID(), identityUserId: null, displayName: null, email: normalized, status: "invited", lastSeenAt: null, roleIds: [roleId] };
      state.members.unshift(created);
      return copy(created);
    },
    async setStatus({ id, status }, { actor }) {
      const target = member(id);
      if (target.identityUserId === actor) throw new HttpError(422, "SELF_MANAGEMENT_FORBIDDEN");
      if (target.status === "invited") throw new HttpError(422, "INVITATION_PENDING");
      if (status === "suspended" && target.status === "active" && target.roleIds.includes(owner().id) && activeOwners() <= 1) throw new HttpError(409, "LAST_OWNER_REQUIRED");
      target.status = status;
      return copy(target);
    },
    async setRole({ memberId, roleId, assigned }) {
      const target = member(memberId);
      role(roleId);
      if (!assigned && roleId === owner().id && target.status === "active" && activeOwners() <= 1) throw new HttpError(409, "LAST_OWNER_REQUIRED");
      target.roleIds = assigned ? [...new Set([...target.roleIds, roleId])] : target.roleIds.filter(item => item !== roleId);
    },
    async listRoles() { return copy(state.roles); },
    async createRole(input) {
      validRole(input);
      const created: Role = { id: randomUUID(), name: input.name, slug: input.slug, description: input.description || null, isSystem: false, permissions: [...new Set(input.permissions)] };
      state.roles.push(created);
      return copy(created);
    },
    async updateRole(id, input) {
      const target = role(id);
      if (target.isSystem) throw new HttpError(409, "SYSTEM_ROLE_IMMUTABLE");
      validRole(input, id);
      Object.assign(target, { name: input.name, slug: input.slug, description: input.description || null, permissions: [...new Set(input.permissions)] });
      return copy(target);
    },
    async deleteRole(id) {
      if (role(id).isSystem) throw new HttpError(409, "SYSTEM_ROLE_IMMUTABLE");
      state.roles = state.roles.filter(item => item.id !== id);
      for (const item of state.members) item.roleIds = item.roleIds.filter(roleId => roleId !== id);
    },
    async permissionCatalog() {
      const groups = new Map<string, string[]>();
      for (const permission of PERMISSIONS) {
        const [resource = permission] = permission.split(":");
        groups.set(resource, [...(groups.get(resource) ?? []), permission]);
      }
      return { groups: [...groups].map(([resource, permissions]) => ({ resource, permissions })) };
    },
  };
}
const runtime = globalThis as typeof globalThis & { gingaMembersMock?: MembersGateway };
export const mockMembersGateway = () => runtime.gingaMembersMock ??= createMockMembersGateway();
