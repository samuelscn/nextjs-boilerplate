// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExampleForm } from "@/components/forms/example-form";
import { ErrorState, EmptyState, LoadingState } from "@/components/feedback";
import { BackofficeShell } from "@/components/backoffice/shell";
import ErrorPage from "@/app/error";
import { QueryProvider } from "@/providers/query-provider";
import { createQueryClient } from "@/lib/query/client";
import type { ExampleResult } from "@/lib/validation/example";

vi.mock("next/navigation", () => ({ usePathname: () => "/backoffice" }));
afterEach(cleanup);
describe("own components and integration with Ginga UI", () => {
  it("validates, submits and handles server field errors accessibly", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async (): Promise<ExampleResult> => ({ ok: false, fieldErrors: { label: "Texto indisponível." }, message: "Revise os campos." }));
    render(<ExampleForm submit={submit} />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe um texto.")).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Texto"), "Exemplo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Texto indisponível.")).toBeVisible();
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
  it("provides semantic backoffice navigation, active link and logout", () => {
    render(<QueryProvider><BackofficeShell><h1>Visão geral</h1></BackofficeShell></QueryProvider>);
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Sair" }).closest("form")).toHaveAttribute("method", "post");
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading"));
  });
  it("never shares Query state between server factories", () => {
    const first = createQueryClient(); const second = createQueryClient();
    first.setQueryData(["private"], "first-user");
    expect(second.getQueryData(["private"])).toBeUndefined();
    first.clear(); second.clear();
  });
});
