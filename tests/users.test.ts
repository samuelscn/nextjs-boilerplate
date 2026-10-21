import { describe, expect, it } from "vitest";
import "./server-only";
import { createUsersStore } from "@/server/users/store";
import { changeRoleSchema, inviteSchema, usersQuerySchema, type UsersQuery } from "@/lib/validation/users";

const base: UsersQuery = { q: "", role: [], status: [], page: 1, pageSize: 10 };

describe("users reference store", () => {
  it("filters by text, role and status, and counts users per role", () => {
    const store = createUsersStore();
    const all = store.list(base);
    expect(all.total).toBe(all.users.length);
    expect(all.roles.reduce((sum, role) => sum + role.users, 0)).toBe(all.total);
    expect(store.list({ ...base, q: "HELENA" }).users.map(user => user.roleId)).toEqual(["admin"]);
    expect(store.list({ ...base, status: ["suspended"] }).users.every(user => user.status === "suspended")).toBe(true);
    expect(store.list({ ...base, role: ["viewer"], status: ["invited"] }).total).toBe(1);
    expect(store.list({ ...base, role: ["admin", "manager"] }).users.every(user => ["admin", "manager"].includes(user.roleId))).toBe(true);
    expect(store.list({ ...base, status: ["active", "invited"] }).total).toBe(store.list({ ...base, status: ["active"] }).total + 1);
  });
  it("paginates and clamps out-of-range pages to the last page", () => {
    const store = createUsersStore();
    const first = store.list({ ...base, pageSize: 3 });
    expect(first).toMatchObject({ page: 1, pageCount: 3, total: 8 });
    expect(first.users).toHaveLength(3);
    const last = store.list({ ...base, pageSize: 3, page: 99 });
    expect(last).toMatchObject({ page: 3, pageCount: 3 });
    expect(last.users).toHaveLength(2);
    expect(store.list({ ...base, q: "zzz" })).toMatchObject({ total: 0, page: 1, pageCount: 1, users: [] });
  });
  it("invites, rejects duplicates and unknown roles", () => {
    const store = createUsersStore();
    const user = store.invite({ email: "new.person@example.com", roleId: "viewer" });
    expect(user).toMatchObject({ status: "invited", name: "", lastAccessAt: null });
    expect(() => store.invite({ email: "NEW.person@example.com", roleId: "viewer" })).toThrowError(expect.objectContaining({ statusCode: 409 }));
    expect(() => store.invite({ email: "x@example.com", roleId: "root" })).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });
  it("changes role and status but never activates a pending invitation", () => {
    const store = createUsersStore();
    const active = store.list({ ...base, status: ["active"] }).users[0]!;
    expect(store.changeRole({ id: active.id, roleId: "support" }).roleId).toBe("support");
    expect(store.changeStatus({ id: active.id, status: "suspended" }).status).toBe("suspended");
    const invited = store.list({ ...base, status: ["invited"] }).users[0]!;
    expect(() => store.changeStatus({ id: invited.id, status: "active" })).toThrowError(expect.objectContaining({ statusCode: 422 }));
    expect(() => store.changeRole({ id: crypto.randomUUID(), roleId: "admin" })).toThrowError(expect.objectContaining({ statusCode: 404 }));
  });
});

describe("users validation", () => {
  it("falls back to an empty query for hostile or malformed search params", () => {
    expect(usersQuerySchema.parse({ q: "x".repeat(500), role: 7, status: "root", page: "-3", pageSize: "9999" }))
      .toEqual({ q: "", role: [], status: [], page: 1, pageSize: 10 });
  });
  it("accepts repeated filter params, drops invalid and duplicate values", () => {
    expect(usersQuerySchema.parse({ role: ["admin", "admin", "viewer"], status: ["active", "root", "invited"], page: "2", pageSize: "20" }))
      .toEqual({ q: "", role: ["admin", "viewer"], status: ["active", "invited"], page: 2, pageSize: 20 });
    expect(usersQuerySchema.parse({ status: "active" }).status).toEqual(["active"]);
  });
  it("validates invitations and role changes", () => {
    expect(inviteSchema.safeParse({ email: "nope", roleId: "viewer" }).success).toBe(false);
    expect(changeRoleSchema.safeParse({ id: "1", roleId: "viewer" }).success).toBe(false);
  });
});
