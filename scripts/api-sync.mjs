// Copies the published Product API contract (OpenAPI + Problem fixtures) into contracts/
// and regenerates TypeScript types. Source: API_CONTRACTS_DIR or ../nestjs-boilerplate/contracts.
import { copyFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const source = resolve(process.env.API_CONTRACTS_DIR ?? "../nestjs-boilerplate/contracts");
const files = ["openapi.json", "problem-fixtures.json"];
if (process.argv.includes("--copy") || !process.argv.includes("--types-only")) {
  for (const file of files) {
    const from = join(source, file);
    if (!existsSync(from)) { console.error(`Missing ${from}. Set API_CONTRACTS_DIR to the API contracts directory.`); process.exit(1); }
    copyFileSync(from, join("contracts", file));
  }
  console.log(`Contracts copied from ${source}`);
}
// Pinned and run through npx: its TypeScript 5 peer must not enter this project's lockfile.
execFileSync("npx", ["-y", "openapi-typescript@7.13.0", "contracts/openapi.json", "-o", "src/lib/api/schema.d.ts", "--root-types", "--root-types-no-schema-prefix"], { stdio: "inherit" });
