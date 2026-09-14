import { describe, expect, it } from "vitest";
import { internalReturnPath, productUrl, safeServiceUrl } from "@/lib/validation/urls";

describe("URL boundaries", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%252fevil.test", "/a/../auth/login", "/auth/login", "/api/session", "/a\nb", "/?x=%0d%0a", "/#evil"])("rejects returnTo %s", value => {
    expect(internalReturnPath(value)).toBe("/app");
  });
  it("preserves internal destinations and encoded query values", () => {
    expect(internalReturnPath("/backoffice?filter=hello%20world")).toBe("/backoffice?filter=hello%20world");
  });
  it.each(["https://evil.test/a", "//evil.test/a", "/../admin", "/%2e%2e/admin", "/%252e%252e/admin", "/a\\b", "/a?url=evil", "/a#fragment", "/a//b", "/a%2fb"])("rejects product path %s", path => {
    expect(() => productUrl("https://api.test/v1", path)).toThrow();
  });
  it("retains configured origin and base prefix", () => {
    expect(productUrl("https://api.test/v1/", "/resource/123").href).toBe("https://api.test/v1/resource/123");
  });
  it("allows insecure services only on loopback with explicit opt-in", () => {
    expect(safeServiceUrl("http://localhost:4000", true)).toBe(true);
    expect(safeServiceUrl("http://remote.test", true)).toBe(false);
    expect(safeServiceUrl("http://localhost:4000")).toBe(false);
    expect(safeServiceUrl("https://user:secret@api.test")).toBe(false);
  });
});
