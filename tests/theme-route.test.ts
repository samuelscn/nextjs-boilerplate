import { describe, expect, it, vi } from "vitest";
import "./server-only";
import { parseEnv } from "@/config/schema";
import { POST } from "@/app/api/theme/route";
import { parseTheme } from "@/lib/theme";

vi.mock("@/config/env", () => ({ getEnv: () => parseEnv({ APP_URL: "https://app.test" }) }));
const form = (body: string, origin = "https://app.test") => new Request("https://app.test/api/theme", {
  method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body,
});

describe("theme preference", () => {
  it("stores a valid theme in a first-party cookie and returns to an internal path", async () => {
    const response = await POST(form("theme=dark&returnTo=%2Fbackoffice%2Fusers"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.test/backoffice/users");
    expect(response.headers.get("set-cookie")).toMatch(/ginga_theme=dark;.*HttpOnly/iu);
  });
  it("rejects unknown themes, duplicates, external return paths and cross-origin posts", async () => {
    expect((await POST(form("theme=neon"))).status).toBe(400);
    expect((await POST(form("theme=dark&theme=light"))).status).toBe(400);
    expect((await POST(form("theme=dark&returnTo=https%3A%2F%2Fevil.test"))).headers.get("location")).toBe("https://app.test/");
    expect((await POST(form("theme=dark", "https://evil.test"))).status).toBe(403);
  });
  it("falls back to system for missing or tampered cookies", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("<script>")).toBe("system");
    expect(parseTheme("light")).toBe("light");
  });
});
