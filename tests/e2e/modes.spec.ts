import { expect, test } from "@playwright/test";

test("production profile, CSP, cookie and unauthenticated boundaries", async ({ page, request, baseURL }, info) => {
  const kind = info.project.name;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /Content Security Policy|hydration/iu.test(message.text())) errors.push(message.text());
  });
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(health.headers()["x-content-type-options"]).toBe("nosniff");
  expect(health.headers()["x-frame-options"]).toBe("DENY");
  expect(health.headers()["strict-transport-security"]).toContain("max-age=");
  const csp = health.headers()["content-security-policy"]!;
  expect(csp).toContain("'nonce-");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp.split("style-src")[0]).not.toContain("'unsafe-inline'");
  expect(health.headers()["cache-control"]).toContain("no-store");

  if (kind === "public") {
    const response = await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ginga Application" })).toBeVisible();
    const html = await response!.text();
    const nonce = response!.headers()["content-security-policy"]!.match(/'nonce-([^']+)'/u)![1];
    expect(html).toContain('nonce="' + nonce + '"');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).href).toBe(baseURL + "/");
    expect((await request.get("/auth/login", { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/api/session")).status()).toBe(404);
    expect((await request.get("/app", { maxRedirects: 0 })).status()).toBe(404);
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Sitemap:");
    expect(await (await request.get("/sitemap.xml")).text()).toContain(baseURL + "/");
  } else {
    const route = kind === "app" ? "/app" : "/backoffice";
    const protectedResponse = await request.get(route, { maxRedirects: 0 });
    expect([303, 307]).toContain(protectedResponse.status());
    expect(protectedResponse.headers()["location"]).toContain("/auth/login");
    expect((await request.get("/api/session")).status()).toBe(401);
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Identity boundary" })).toBeVisible();
    const authorization = new URL(page.url());
    expect(authorization.origin).toBe("https://localhost:4443");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("state")).toBeTruthy();
    expect(authorization.searchParams.get("nonce")).toBeTruthy();
    expect(authorization.searchParams.has("client_secret")).toBe(false);
    const cookie = (await page.context().cookies()).find(item => item.name === "__Host-ginga_transaction")!;
    expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax" });
    expect(cookie.value).toHaveLength(43);
    const denied = await request.get("/auth/callback?code=attacker&state=wrong&iss=https://evil.test", { maxRedirects: 0 });
    expect(denied.headers()["location"]).toContain("reason=invalid");
    expect(denied.headers()["set-cookie"]).not.toContain("__Host-ginga_session=");
    expect((await request.post("/auth/logout", { headers: { origin: "https://evil.test" } })).status()).toBe(403);
    expect((await request.get("/auth/logout")).status()).toBe(405);
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  }
  expect(errors).toEqual([]);
});

test("neutral error UI and mobile viewport", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(info.project.name === "public" ? "/" : "/auth/error?reason=unavailable");
  await expect(page.getByRole("main")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});
