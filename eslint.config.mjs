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
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message: "Use the validated server-only config boundary.",
      }, {
        selector: "BinaryExpression[left.property.name='message'], BinaryExpression[right.property.name='message'], SwitchStatement[discriminant.property.name='message']",
        message: "Error.message is not a contract. Use code/statusCode.",
      }],
    },
  },
  {
    // UI: translated text only, DS primitives only, browser data through the BFF.
    files: ["src/components/**/*.tsx", "src/app/**/*.tsx", "src/providers/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "JSXText[value=/[A-Za-zÀ-ÿ]{2,}/]",
        message: "UI text must come from next-intl messages (t(...)), in pt-BR and en.",
      }, {
        selector: "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt|label)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2,}/]",
        message: "Accessible names and labels must come from next-intl messages.",
      }, {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message: "Use the validated server-only config boundary.",
      }],
      "no-restricted-globals": ["error", { name: "fetch", message: "Browser data goes through bffRequest (src/lib/http/browser.ts); server data through a gateway." }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**", "src/app/**", "src/config/**", "src/proxy.ts", "src/instrumentation.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/server/**", "@/config/env"], message: "Server-only modules: read them in page/layout/route files." },
        { group: ["@base-ui/*", "@radix-ui/*", "class-variance-authority"], message: "Use @ginga/ui primitives; do not copy or wrap primitives in the product." },
      ] }],
    },
  },
  { files: ["src/server/**", "src/app/**", "src/config/**", "src/proxy.ts", "src/instrumentation.ts"], rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@base-ui/*", "@radix-ui/*"], message: "Use @ginga/ui primitives." },
  ] }] } },
  { files: ["src/config/env.ts", "src/instrumentation.ts"], rules: { "no-restricted-syntax": "off" } },
]);
