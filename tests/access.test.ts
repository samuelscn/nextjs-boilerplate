import { describe, expect, it } from "vitest";
import "./server-only";
import { can, canAny } from "@/lib/access/permissions";
import { myAccessSchema, PERMISSIONS } from "@/server/access/catalog";
import { mockAccess } from "@/server/access/mock";

describe("access", () => {
  it("evaluates permissions with default deny", () => {
    expect(can({ permissions: ["member:read"] }, "member:read")).toBe(true);
    expect(can({ permissions: ["member:read"] }, "member:invite")).toBe(false);
    expect(can(null, "member:read")).toBe(false);
    expect(canAny({ permissions: ["role:read"] }, ["member:read", "role:read"])).toBe(true);
  });
  it("drops permissions unknown to this build instead of trusting them", () => {
    expect(myAccessSchema.parse({ userId: "u1", roleIds: [], permissions: ["member:read", "member:read", "root:all"] }).permissions).toEqual(["member:read"]);
  });
  it("mock grants configured permissions only", () => {
    expect(mockAccess("u1", "*").permissions).toEqual(PERMISSIONS);
    expect(mockAccess("u1", " role:read , unknown:x").permissions).toEqual(["role:read"]);
    expect(mockAccess("u1", "").permissions).toEqual([]);
  });
});
