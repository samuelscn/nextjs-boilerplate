import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
  } },
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["tests/**/*.test.{ts,tsx}"], restoreMocks: true, clearMocks: true },
});
