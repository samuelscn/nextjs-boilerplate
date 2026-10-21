// Claude Code PreToolUse hook (Edit/Write): blocks edits to files that must never be
// hand-edited. Exit code 2 refuses the tool call and shows the reason to the agent.
import { relative, resolve } from "node:path";

const input = JSON.parse(await new Promise(done => { let data = ""; process.stdin.on("data", chunk => { data += chunk; }); process.stdin.on("end", () => done(data || "{}")); }));
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!target) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const path = relative(root, resolve(root, target)).replaceAll("\\", "/");
const rules = [
  [/^\.env(?!\.example$)/u, "Environment files hold secrets. Edit .env.example and ask the user to set values."],
  [/^vendor\//u, "vendor/ holds the packed Design System tarball. Change ginga-design-system and repack instead."],
  [/^package-lock\.json$/u, "Use npm install/uninstall to change dependencies; never hand-edit the lockfile."],
  [/^src\/lib\/api\/schema\.d\.ts$/u, "Generated from contracts/openapi.json. Run `npm run api:sync` (or `api:types`)."],
  [/^contracts\//u, "Copied from the Product API. Change the API, export its contract and run `npm run api:sync`."],
];
for (const [pattern, reason] of rules) if (pattern.test(path)) { console.error(`Blocked edit to ${path}: ${reason}`); process.exit(2); }
