import { describe, expect, it } from "vitest";
import { hrefWithParams, patchSearchParams, pageRange, toRawSearchParams, toSearchParams } from "@/lib/list/params";
import { usersQuerySchema } from "@/lib/validation/users";

describe("patchSearchParams", () => {
  it("replaces multi-value filters, drops empty values and resets page", () => {
    const next = patchSearchParams(new URLSearchParams("q=ana&role=admin&page=3"), { role: ["manager", "viewer"], q: "" });
    expect(next.getAll("role")).toEqual(["manager", "viewer"]);
    expect(next.has("q")).toBe(false);
    expect(next.has("page")).toBe(false);
  });
  it("keeps page when set explicitly and omits values equal to defaults", () => {
    expect(patchSearchParams(new URLSearchParams("q=ana"), { page: 2 }).toString()).toBe("q=ana&page=2");
    expect(patchSearchParams(new URLSearchParams("pageSize=20"), { pageSize: 10 }, { pageSize: 10 }).has("pageSize")).toBe(false);
  });
});

describe("pageRange", () => {
  it.each([
    [1, 5, [1, 2, 3, 4, 5]],
    [1, 20, [1, 2, 3, 4, 5, "ellipsis", 20]],
    [10, 20, [1, "ellipsis", 9, 10, 11, "ellipsis", 20]],
    [20, 20, [1, "ellipsis", 16, 17, 18, 19, 20]],
  ])("page %i of %i", (page, count, expected) => expect(pageRange(page, count)).toEqual(expected));
});


describe("query round trip for GET BFF routes", () => {
  it("serializes a parsed query and parses it back with the page schema", () => {
    const role = ["0b6f1d1e-3c55-4b8e-9d55-2f4c6a1e7b10", "7c1f0e2a-5b3d-4f6e-8a9b-1c2d3e4f5a6b"];
    const query = usersQuerySchema.parse({ q: "ana", role, status: "active", pageSize: "20" });
    const params = toSearchParams({ ...query, page: 3 });
    expect(params.getAll("role")).toEqual(role);
    expect(params.has("q") && params.get("page")).toBe("3");
    expect(usersQuerySchema.parse(toRawSearchParams(params))).toEqual({ ...query, page: 3 });
  });
  it("keeps single values as strings and repeated keys as arrays", () => {
    expect(toRawSearchParams(new URLSearchParams("q=a&status=active&status=invited"))).toEqual({ q: "a", status: ["active", "invited"] });
  });
});

describe("hrefWithParams", () => {
  it("keeps filters even where URLSearchParams.size is missing (Safari < 17)", () => {
    const params = new URLSearchParams("status=active&page=2");
    Object.defineProperty(params, "size", { value: undefined });
    expect(hrefWithParams("/backoffice/users", params)).toBe("/backoffice/users?status=active&page=2");
    expect(hrefWithParams("/backoffice/users", new URLSearchParams())).toBe("/backoffice/users");
  });
});
