import { describe, expect, it } from "vitest";
import { patchSearchParams, pageRange } from "@/lib/list/params";

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

