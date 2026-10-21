import "server-only";
import type { Member, MemberPage, PermissionCatalog, Role, RoleValues, UsersQuery } from "@/lib/validation/users";

// Product operations for user and role management. Implementations: live (Product API)
// and mock (in-process, same contract and error codes). Pages and BFF routes depend on this
// interface only; `actor` is the signed-in subject, used by the mock to mirror API rules.
export interface MembersGateway {
  listMembers(query: UsersQuery, context: CallContext): Promise<MemberPage>;
  invite(input: { email: string; roleId: string }, context: CallContext): Promise<Member>;
  setStatus(input: { id: string; status: "active" | "suspended" }, context: CallContext): Promise<Member>;
  setRole(input: { memberId: string; roleId: string; assigned: boolean }, context: CallContext): Promise<void>;
  listRoles(context: CallContext): Promise<Role[]>;
  createRole(input: RoleValues, context: CallContext): Promise<Role>;
  updateRole(id: string, input: RoleValues, context: CallContext): Promise<Role>;
  deleteRole(id: string, context: CallContext): Promise<void>;
  permissionCatalog(context: CallContext): Promise<PermissionCatalog>;
}
export type CallContext = { actor: string; requestId: string };
