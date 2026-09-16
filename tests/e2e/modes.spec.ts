import { expect, test } from "@playwright/test";

test("application utilities and DS token overrides", async ({ page }) => {
  await page.goto("/auth/error?reason=unavailable");
  const form = page.locator('form[action="/api/locale"]');
  const field = form.locator('[data-slot="field"]');
  await expect(form).toHaveCSS("display", "flex");
  await expect(form).toHaveCSS("gap", "12px");
  await expect(field).toHaveCSS("flex-direction", "row");
  const desktopForm = await form.boundingBox();
  const desktopField = await field.boundingBox();
  expect(desktopField!.width).toBeLessThan(desktopForm!.width / 2);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileForm = await form.boundingBox();
  const mobileField = await field.boundingBox();
  expect(mobileField!.width).toBeCloseTo(mobileForm!.width - 32, 0);

  // Both DS components and consumer utilities resolve the product's live tokens.
  for (const dark of [false, true]) {
    await page.evaluate(dark => {
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.setProperty("--background", "rgb(12, 34, 56)");
      document.documentElement.style.setProperty("--primary", "rgb(45, 67, 89)");
      document.documentElement.style.setProperty("--radius", "20px");
      const probe = document.createElement("div");
      probe.id = "theme-probe";
      probe.className = "bg-primary";
      document.querySelector("#theme-probe")?.remove();
      document.body.append(probe);
    }, dark);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(12, 34, 56)");
    await expect(form.getByRole("button", { name: "Aplicar idioma" })).toHaveCSS("border-radius", "20px");
    await expect(page.locator("#theme-probe")).toHaveCSS("background-color", "rgb(45, 67, 89)");
  }
});

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
    expect(new URL(canonical!).href).toBe(baseURL + "/pt-BR");
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

test("locale URLs, preference cookie, metadata and localized errors", async ({ page, request, baseURL }, info) => {
  const kind = info.project.name;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /Content Security Policy|hydration/iu.test(message.text())) errors.push(message.text());
  });
  await page.goto(kind === "public" ? "/pt-BR" : "/auth/error?reason=unavailable");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("combobox", { name: "Idioma" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await page.getByRole("button", { name: "Aplicar idioma" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const cookie = (await page.context().cookies()).find(value => value.name === "ginga_locale");
  expect(cookie).toMatchObject({ value: "en", secure: true, httpOnly: true, sameSite: "Lax" });
  if (kind === "public") {
    await expect(page).toHaveURL(baseURL + "/en");
    await expect(page.getByText("Ready to get started")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", baseURL + "/en");
    await expect(page.locator('link[hreflang="pt-BR"]')).toHaveAttribute("href", baseURL + "/pt-BR");
    await page.goto("/pt-BR");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR"); // URL wins over cookie.
    await page.goto("/en/missing");
  } else {
    await page.goto("/auth/error?reason=unavailable");
    await expect(page.getByRole("heading", { name: "Identity unavailable" })).toBeVisible();
    const response = await request.get("/api/session", { headers: { "x-correlation-id": "req_E2E" } });
    expect(await response.json()).toMatchObject({ statusCode: 401, code: "AUTHENTICATION_REQUIRED", requestId: "req_E2E" });
    expect(response.headers()["x-correlation-id"]).toBe("req_E2E");
    await page.goto("/missing");
  }
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(errors).toEqual([]);
});
