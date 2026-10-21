// Opens a visible Chromium on the protected area so a developer signs in to Ginga Identity
// by hand, then saves the browser storage state for the `playwright-session` MCP server.
// The script never sees or types credentials. The file holds a session cookie: it is
// gitignored and valid only while the dev server keeps that in-memory session.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const target = new URL(process.argv[2] ?? "/backoffice", appUrl);
const output = ".playwright-mcp/storage-state.json";
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ locale: "pt-BR" });
const page = await context.newPage();
await page.goto(target.href);
console.log(`Sign in in the opened browser. Waiting until you are back on ${target.origin}${target.pathname}…`);
await page.waitForURL(url => url.origin === target.origin && url.pathname.startsWith(target.pathname), { timeout: 10 * 60_000 });
mkdirSync(".playwright-mcp", { recursive: true });
await context.storageState({ path: output });
await browser.close();
console.log(`Session saved to ${output}. Use the "playwright-session" MCP server.`);
