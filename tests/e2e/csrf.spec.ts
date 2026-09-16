import { expect, test } from "@playwright/test";

test("locale form sends its real origin and switches both ways", async ({ page, baseURL }) => {
  await page.goto("/auth/error?reason=unavailable");
  for (const [label, option, submit, locale] of [
    ["Idioma", "English", "Aplicar idioma", "en"],
    ["Language", "Português (Brasil)", "Apply language", "pt-BR"],
  ] as const) {
    await page.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option }).click();
    const pending = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/api/locale"));
    await page.getByRole("button", { name: submit }).click();
    const response = await pending;
    expect(await response.request().headerValue("origin")).toBe(baseURL);
    expect(response.status()).toBe(303);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  }
});

test("logout form passes CSRF and clears the session cookie", async ({ page, baseURL }, info) => {
  test.skip(info.project.name === "public", "Public has no auth capability");
  await page.goto("/auth/error?reason=unavailable");
  // Same native POST transport as LogoutButton; session invalidation is covered
  // in session.test.ts without adding an authentication bypass to the test server.
  await page.locator("body").evaluate(body => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/logout";
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Logout test";
    form.append(button);
    body.append(form);
  });
  const pending = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/auth/logout"));
  await page.locator('form[action="/auth/logout"] button').click();
  const response = await pending;
  expect(await response.request().headerValue("origin")).toBe(baseURL);
  expect(response.status()).toBe(303);
  expect(await response.headerValue("set-cookie")).toContain("Max-Age=0");
});

test("mutations reject absent, null, foreign and same-site origins", async ({ request, baseURL }, info) => {
  const paths = info.project.name === "public" ? ["/api/locale"] : ["/api/locale", "/auth/logout"];
  for (const path of paths) {
    for (const headers of [{}, { origin: "null" }, { origin: "https://evil.test" },
      { origin: baseURL!, "sec-fetch-site": "same-site" },
      { origin: baseURL!, "sec-fetch-site": "cross-site" }]) {
      const response = await request.post(path, {
        headers, form: { locale: "en", returnTo: "/auth/error" }, maxRedirects: 0,
      });
      expect(response.status()).toBe(403);
      expect(await response.json()).toMatchObject({ code: "AUTHORIZATION_FORBIDDEN" });
      expect(response.headers()["set-cookie"]).toBeUndefined();
    }
  }
});

test("external navigation does not disclose the referring page", async ({ page }) => {
  await page.goto("/auth/error?reason=unavailable&private=test-canary");
  await page.locator("body").evaluate(body => {
    const link = document.createElement("a");
    link.href = "https://localhost:4443/api/auth/oauth2/authorize";
    link.textContent = "External test destination";
    body.append(link);
  });
  const pending = page.waitForRequest("https://localhost:4443/api/auth/oauth2/authorize");
  await page.getByRole("link", { name: "External test destination" }).click();
  expect(await (await pending).headerValue("referer")).toBeNull();
});
