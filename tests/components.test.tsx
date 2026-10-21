// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render as renderUI, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { catalogs } from "@/i18n/catalogs";
import type { Locale } from "@/i18n/config";
import { ApiError, NetworkError } from "@/lib/http/api-error";
import userEvent from "@testing-library/user-event";
import { ExampleForm } from "@/components/forms/example-form";
import { ErrorState, EmptyState, LoadingState } from "@/components/feedback";
import { BackofficeShell } from "@/components/backoffice/shell";
import ErrorPage from "@/app/error";
import { QueryProvider } from "@/providers/query-provider";
import { createQueryClient } from "@/lib/query/client";
import type { ExampleResult } from "@/lib/validation/example";

vi.mock("next/navigation", () => ({ usePathname: () => "/backoffice/users" }));
afterEach(cleanup);
// jsdom has no matchMedia, which the DS Sidebar uses to detect mobile.
Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) });
const render = (ui: React.ReactNode, locale: Locale = "pt-BR") => renderUI(<NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">{ui}</NextIntlClientProvider>);
describe("own components and integration with Ginga UI", () => {
  it("validates and renders server errors in English", async () => {
    render(<ExampleForm submit={async () => ({ ok: false, error: {
      status: 400, code: "VALIDATION_ERROR", detail: "unsafe message", timestamp: new Date().toISOString(),
      errors: [{ field: "label", code: "MAX_LENGTH" }],
    } })} />, "en");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This field is required.")).toBeVisible();
    await userEvent.type(screen.getByLabelText("Text"), "Example");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The value is too long.")).toBeVisible();
    expect(screen.getByLabelText("Text")).toHaveFocus();
    expect(screen.queryByText("unsafe field")).not.toBeInTheDocument();
  });
  it.each(["pt-BR", "en"] as const)("offers login only for 401, not 403 (%s)", locale => {
    const failure = (status: number, code: string) => new ApiError({ status, code, traceId: "req_SUPPORT" });
    const view = render(<ErrorState error={failure(403, "AUTHORIZATION_FORBIDDEN")} />, locale);
    expect(screen.getByRole("alert")).toHaveTextContent(catalogs[locale].errors.AUTHORIZATION_FORBIDDEN);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/req_SUPPORT/u)).toBeVisible();
    view.unmount();
    render(<ErrorState error={failure(401, "AUTHENTICATION_REQUIRED")} />, locale);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/login");
  });
  it("renders a localized network fallback without technical error text", () => {
    render(<ErrorState error={new NetworkError()} />, "en");
    expect(screen.getByRole("alert")).toHaveTextContent(catalogs.en.errors.NETWORK_ERROR);
  });
  it("validates, submits and handles server field errors accessibly", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async (): Promise<ExampleResult> => ({ ok: false, error: {
      status: 400, code: "VALIDATION_ERROR", detail: "Do not render this message", timestamp: new Date().toISOString(),
      errors: [{ field: "label", code: "MAX_LENGTH" }],
    } }));
    render(<ExampleForm submit={submit} />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Preencha este campo.")).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Texto"), "Exemplo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O valor informado é muito longo.")).toBeVisible();
    expect(screen.getByLabelText("Texto")).toHaveFocus();
    expect(submit).toHaveBeenCalledWith({ label: "Exemplo" });
  });
  it("blocks duplicate submission and shows success", async () => {
    const user = userEvent.setup();
    let resolve!: (result: ExampleResult) => void;
    render(<ExampleForm submit={() => new Promise(done => { resolve = done; })} />);
    await user.type(screen.getByLabelText("Texto"), "Exemplo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    resolve({ ok: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Salvo.");
  });
  it("does not expose thrown server messages", async () => {
    const user = userEvent.setup();
    render(<ExampleForm submit={async () => { throw new Error("internal credential"); }} />);
    await user.type(screen.getByLabelText("Texto"), "Exemplo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("internal credential");
  });
  it("renders empty, error and loading boundaries", () => {
    render(<><EmptyState /><ErrorState /><LoadingState /></>);
    expect(screen.getByText("Nenhum conteúdo")).toBeVisible();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("status", { name: "Carregando" })).toBeVisible();
  });
  it("retries a failed segment using the current Next API", async () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error("private detail")} retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText("private detail")).not.toBeInTheDocument();
  });
  it("provides semantic backoffice navigation, active link, language and logout", async () => {
    render(<QueryProvider><BackofficeShell><h1>Visão geral</h1></BackofficeShell></QueryProvider>);
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Minha conta" }));
    expect((await screen.findByRole("menuitem", { name: "Sair" })).closest("form")).toHaveAttribute("method", "post");
    expect(screen.getByRole("menuitem", { name: "English" }).closest("form")).toHaveAttribute("action", "/api/locale");
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading"));
  });
  it("never shares Query state between server factories", () => {
    const first = createQueryClient(); const second = createQueryClient();
    first.setQueryData(["private"], "first-user");
    expect(second.getQueryData(["private"])).toBeUndefined();
    first.clear(); second.clear();
  });
});
