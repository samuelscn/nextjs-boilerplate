import { describe, expect, it } from "vitest";
import "./server-only";
import { createMockMembersGateway } from "@/server/members/mock";
import { inviteSchema, roleInputSchema, usersQuerySchema, type UsersQuery } from "@/lib/validation/users";

const base: UsersQuery = { q: "", role: [], status: [], page: 1, pageSize: 10 };
const context = { actor: "mock_helena.duarte", requestId: "req_test" };

describe("members mock gateway (API_MODE=mock)", () => {
  it("filters by text, several roles and statuses, and paginates with clamping", async () => {
    const gateway = createMockMembersGateway();
    const roles = await gateway.listRoles(context);
    const id = (slug: string) => roles.find(role => role.slug === slug)!.id;
    const all = await gateway.listMembers(base, context);
    expect(all).toMatchObject({ total: 14, page: 1, pageSize: 10 });
    expect(all.items).toHaveLength(10);
    expect((await gateway.listMembers({ ...base, q: "HELENA" }, context)).items.map(item => item.email)).toEqual(["helena.duarte@example.com"]);
    const filtered = await gateway.listMembers({ ...base, role: [id("owner"), id("admin")], status: ["active"] }, context);
    expect(filtered.items.every(item => item.status === "active" && item.roleIds.some(role => [id("owner"), id("admin")].includes(role)))).toBe(true);
    expect((await gateway.listMembers({ ...base, pageSize: 10, page: 99 }, context)).page).toBe(2);
  });
  it("mirrors API rules and problem codes", async () => {
    const gateway = createMockMembersGateway();
    const roles = await gateway.listRoles(context);
    const owner = roles.find(role => role.slug === "owner")!;
    const member = roles.find(role => role.slug === "member")!;
    const invited = await gateway.invite({ email: "New.Person@Example.com", roleId: member.id }, context);
    expect(invited).toMatchObject({ status: "invited", email: "new.person@example.com", identityUserId: null, roleIds: [member.id] });
    await expect(gateway.invite({ email: "new.person@example.com", roleId: member.id }, context)).rejects.toMatchObject({ statusCode: 409, code: "MEMBER_ALREADY_EXISTS" });
    await expect(gateway.setStatus({ id: invited.id, status: "active" }, context)).rejects.toMatchObject({ statusCode: 422, code: "INVITATION_PENDING" });
    const self = (await gateway.listMembers({ ...base, q: "helena" }, context)).items[0]!;
    await expect(gateway.setStatus({ id: self.id, status: "suspended" }, context)).rejects.toMatchObject({ code: "SELF_MANAGEMENT_FORBIDDEN" });
    await expect(gateway.setRole({ memberId: self.id, roleId: owner.id, assigned: false }, context)).rejects.toMatchObject({ code: "LAST_OWNER_REQUIRED" });
    await expect(gateway.updateRole(owner.id, { name: "x", slug: "x", description: "", permissions: ["member:read"] }, context)).rejects.toMatchObject({ code: "SYSTEM_ROLE_IMMUTABLE" });
    const custom = await gateway.createRole({ name: "Auditor", slug: "auditor", description: "", permissions: ["member:read"] }, context);
    await expect(gateway.createRole({ name: "Auditor", slug: "auditor", description: "", permissions: ["member:read"] }, context)).rejects.toMatchObject({ statusCode: 409 });
    await gateway.setRole({ memberId: invited.id, roleId: custom.id, assigned: true }, context);
    await gateway.deleteRole(custom.id, context);
    expect((await gateway.listMembers({ ...base, q: "new.person" }, context)).items[0]!.roleIds).toEqual([member.id]);
  });
});

describe("users validation", () => {
  it("falls back to an empty query for hostile or malformed search params", () => {
    expect(usersQuerySchema.parse({ q: "x".repeat(500), role: ["not-a-uuid"], status: "root", page: "-3", pageSize: "9999" }))
      .toEqual({ q: "", role: [], status: [], page: 1, pageSize: 10 });
  });
  it("accepts repeated filter params, drops invalid and duplicate values", () => {
    const id = crypto.randomUUID();
    expect(usersQuerySchema.parse({ role: [id, id], status: ["active", "root", "invited"], page: "2", pageSize: "20" }))
      .toEqual({ q: "", role: [id], status: ["active", "invited"], page: 2, pageSize: 20 });
  });
  it("validates invitations and roles", () => {
    expect(inviteSchema.safeParse({ email: "nope", roleId: crypto.randomUUID() }).success).toBe(false);
    expect(roleInputSchema.safeParse({ name: "Auditor", slug: "Auditor Role", description: "", permissions: ["member:read"] }).success).toBe(false);
    expect(roleInputSchema.safeParse({ name: "Auditor", slug: "auditor", description: "", permissions: [] }).success).toBe(false);
  });
});
