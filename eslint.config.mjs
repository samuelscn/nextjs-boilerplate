import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import query from "@tanstack/eslint-plugin-query";

export default defineConfig([
  { ...js.configs.recommended, files: ["**/*.{ts,tsx}"] },
  ...ts.configs.recommended,
  next.configs["core-web-vitals"],
  hooks.configs.flat.recommended,
  ...query.configs["flat/recommended"],
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "vendor/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/server/**", "@/config/env"] }],
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message: "Use the validated server-only config boundary.",
      }],
    },
  },
  { files: ["src/server/**", "src/app/**", "src/config/**", "src/proxy.ts", "src/instrumentation.ts"], rules: { "no-restricted-imports": "off" } },
  { files: ["src/config/env.ts", "src/instrumentation.ts"], rules: { "no-restricted-syntax": "off" } },
]);
