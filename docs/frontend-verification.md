# Verificação visual com Playwright MCP

O repositório traz um servidor MCP do Playwright (`.mcp.json` + `.playwright/mcp.config.json`) para que agentes de código abram a aplicação em um browser real durante a construção do frontend, em vez de confiar apenas em lint/typecheck.

## Setup

1. `npx playwright install chromium` (uma vez; o MCP também oferece `browser_install`).
2. `npm run dev` (porta 3000, ver `APP_URL` em `.env`).
3. Abra o projeto no Claude Code; aprove o servidor `playwright` do `.mcp.json` quando solicitado.

A versão do `@playwright/mcp` é fixada no `.mcp.json` e executada via `npx`; não é dependência do app e não altera o `package-lock.json`. Atualize junto com o Playwright em `docs/dependencies.md`.

## Configuração

- Chromium headless, contexto isolado (sem perfil persistente), locale `pt-BR`, viewport 1280x800.
- `network.allowedOrigins` restrito a `localhost:3000`. Se mudar a porta, ajuste o arquivo. Não é fronteira de segurança, apenas evita que o agente navegue para fora por engano.
- Capability `devtools` habilitada; console em nível `warning`.
- Artefatos (screenshots, snapshots) em `.playwright-mcp/`, ignorado pelo git.

## Autenticação

Perfis `app` e `backoffice` redirecionam ao Ginga Identity. O agente não deve digitar credenciais reais nem contornar o fluxo. Opções:

- Verificar telas públicas e o redirecionamento sem sessão.
- Subir Identity local e fazer login manualmente em um browser headed (`--headed` via override da config) enquanto a sessão durar.
- Para validar componentes isolados, usar rotas públicas de exemplo ou testes de componente.

Sessões ficam apenas em memória do servidor; nada de token é persistido pelo MCP por causa de `isolated`.

## Fluxo esperado do agente

1. `browser_navigate` para a rota alterada.
2. `browser_snapshot` (árvore de acessibilidade) para validar estrutura, labels e textos traduzidos. Prefira snapshot a screenshot.
3. Interagir (`browser_click`, `browser_type`, `browser_fill_form`) e validar estados: loading, vazio, erro, paginação, filtros via URL.
4. `browser_console_messages` deve estar sem erros de CSP/hydration.
5. `browser_resize` para mobile (390x844) e `browser_take_screenshot` para checar layout.
6. Testar nos dois locales (`pt-BR`, `en`) conforme `docs/internationalization.md`.

O MCP é ferramenta de verificação durante o desenvolvimento. Comportamento que deve permanecer garantido vira teste em `tests/e2e` ou Vitest.
