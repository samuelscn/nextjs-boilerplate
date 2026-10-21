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

Perfis `app` e `backoffice` redirecionam ao Ginga Identity. O agente nunca digita credenciais nem contorna o fluxo.

1. Com `npm run dev` rodando, execute `npm run dev:login` (opcionalmente com a rota: `npm run dev:login -- /backoffice/users`). Um Chromium visível abre; **você** entra no Identity.
2. Ao voltar para a aplicação, o script salva `.playwright-mcp/storage-state.json` (gitignored).
3. O agente usa o servidor MCP `playwright-session`, que carrega essa sessão. O `playwright` continua anônimo, para telas públicas e para conferir o redirect.

A sessão vive na memória do servidor de desenvolvimento: reiniciar o `npm run dev` ou expirar a sessão exige repetir o passo 1. Para telas restritas, combine com `API_MODE=mock` e `API_MOCK_PERMISSIONS` (por exemplo `member:read`) para verificar estados sem permissão.

## Fluxo esperado do agente

1. `browser_navigate` para a rota alterada.
2. `browser_snapshot` (árvore de acessibilidade) para validar estrutura, labels e textos traduzidos. Prefira snapshot a screenshot.
3. Interagir (`browser_click`, `browser_type`, `browser_fill_form`) e validar estados: loading, vazio, erro, paginação, filtros via URL.
4. `browser_console_messages` deve estar sem erros de CSP/hydration.
5. `browser_resize` para mobile (390x844) e `browser_take_screenshot` para checar layout.
6. Testar nos dois locales (`pt-BR`, `en`) conforme `docs/internationalization.md`.

O MCP é ferramenta de verificação durante o desenvolvimento. Comportamento que deve permanecer garantido vira teste em `tests/e2e` ou Vitest.
