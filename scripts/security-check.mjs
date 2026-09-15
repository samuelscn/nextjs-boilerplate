import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : join(directory, entry.name)))).flat();
}
const source = await files("src");
for (const path of source.filter(path => /\.(ts|tsx)$/u.test(path))) {
  const content = await readFile(path, "utf8");
  if (path.startsWith("src/server/") || path === "src/config/env.ts") assert.match(content, /import ["']server-only["']/u, "Missing server-only: " + path);
  assert.doesNotMatch(content, /dangerouslySetInnerHTML|localStorage|sessionStorage|@ts-ignore/u, "Unsafe boundary: " + path);
  if (!["src/config/env.ts", "src/instrumentation.ts"].includes(path)) assert.doesNotMatch(content, /process\.env/u, "Decentralized env: " + path);
  if (/^["']use client["']/u.test(content)) assert.doesNotMatch(content, /@\/server|@\/config\/env/u, "Client imports server code: " + path);
}
const markers = ["OIDC_CLIENT_SECRET", "GINGA_IDENTITY_CLIENT_SECRET", "ginga-build-secret-canary-24f6c4f0", "test-only-e2e-secret"];
if (process.env.OIDC_CLIENT_SECRET) markers.push(process.env.OIDC_CLIENT_SECRET);
const chunks = await files(".next/static");
assert.ok(chunks.length, "Build before running security:check");
for (const path of chunks.filter(path => /\.(js|map|html)$/u.test(path))) {
  const content = await readFile(path, "utf8");
  for (const marker of markers) assert.ok(!content.includes(marker), "Secret marker found in browser artifact: " + path);
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
for (const name of ["next", "react", "react-dom", "openid-client", "jose", "zod", "react-hook-form", "@tanstack/react-query", "next-intl"]) {
  assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/u, "Critical dependency must be pinned: " + name);
}
assert.equal(pkg.dependencies.react, pkg.dependencies["react-dom"]);
assert.ok(!pkg.workspaces, "No inherited product workspaces");
console.log("Server/client invariants and browser bundle secret checks passed.");
