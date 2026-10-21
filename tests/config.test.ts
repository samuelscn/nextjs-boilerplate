import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/schema";
import { capabilities } from "@/config/capabilities";
import { authEnv } from "./helpers";

describe("capability environment", () => {
  it("public needs no Identity runtime config and discards secrets", () => {
    expect(parseEnv({ OIDC_CLIENT_SECRET: "never-copy-this" })).toEqual({
      NODE_ENV: "development", APP_KIND: "public", APP_URL: "http://localhost:3000", APP_NAME: "Ginga Application",
      I18N_DEFAULT_LOCALE: "pt-BR", I18N_URL_STRATEGY: "public-prefix",
    });
  });
  it.each(["app", "backoffice"])("requires auth settings for %s", APP_KIND => {
    expect(() => parseEnv({ APP_KIND })).toThrow("Invalid environment");
    expect(authEnv({ APP_KIND }).APP_KIND).toBe(APP_KIND);
  });
  it("requires a confidential secret; supports registered public clients", () => {
    expect(() => authEnv({ OIDC_CLIENT_SECRET: "" })).toThrow("OIDC_CLIENT_SECRET");
    expect(authEnv({ OIDC_CLIENT_TYPE: "public", OIDC_CLIENT_SECRET: "" }).OIDC_CLIENT_TYPE).toBe("public");
  });
  it("requires HTTPS and explicit single-process deployment in production", () => {
    expect(() => authEnv({ NODE_ENV: "production" })).toThrow("SESSION_SINGLE_PROCESS");
    expect(() => authEnv({ NODE_ENV: "production", SESSION_SINGLE_PROCESS: "true", OIDC_ALLOW_HTTP: "true" })).toThrow();
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow("APP_URL");
    expect(authEnv({ NODE_ENV: "production", SESSION_SINGLE_PROCESS: "true" }).NODE_ENV).toBe("production");
  });
  it("defaults to mock data outside production and refuses mock in production", () => {
    expect(authEnv().API_MODE).toBe("mock");
    expect(authEnv({ API_MODE: "live" }).API_MODE).toBe("live");
    expect(authEnv({ NODE_ENV: "production", SESSION_SINGLE_PROCESS: "true" }).API_MODE).toBe("live");
    expect(() => authEnv({ NODE_ENV: "production", SESSION_SINGLE_PROCESS: "true", API_MODE: "mock" })).toThrow("API_MODE");
  });
  it.each(["https://user:secret@app.test", "https://app.test/path", "https://app.test/#fragment", "//app.test", "javascript:alert(1)"])("rejects unsafe origin %s", APP_URL => {
    expect(() => parseEnv({ APP_URL })).toThrow();
  });
  it("does not disclose invalid values", () => {
    try { parseEnv({ APP_KIND: "secret-value" }); } catch (error) { expect(String(error)).not.toContain("secret-value"); }
  });
  it("rejects invalid mode and dependencies fail closed", () => {
    expect(() => parseEnv({ APP_KIND: "landing-typo" })).toThrow();
    expect(capabilities("public").auth).toBe(false);
    expect(capabilities("backoffice")).toMatchObject({ auth: true, bff: true, query: true });
  });
});
