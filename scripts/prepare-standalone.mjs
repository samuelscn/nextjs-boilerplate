import { cp, access } from "node:fs/promises";

await access(".next/standalone/server.js");
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
