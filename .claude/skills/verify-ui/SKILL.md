---
name: verify-ui
description: Verify a changed screen in a real browser with the Playwright MCP (accessibility snapshot, states, console, mobile, both locales). Use after creating or changing UI, before reporting it done.
---

# Verificar UI no navegador

Detalhes em docs/frontend-verification.md.

1. `npm run dev` (com `API_MODE=mock` se não houver Product API) e confirme em `GET /api/health` o modo e as flags.
2. Rotas protegidas exigem sessão do Ginga Identity: peça ao usuário para entrar; **nunca** digite credenciais nem contorne o login.
3. Com o MCP `playwright`:
   - `browser_navigate` na rota; `browser_snapshot` para estrutura, nomes acessíveis e textos traduzidos;
   - exercite busca (aguarde o debounce), filtros múltiplos, paginação e confira a URL;
   - estados: vazio, erro (ex.: código do mock), sem permissão (`API_MOCK_PERMISSIONS`), flag desligada;
   - `browser_console_messages` sem erros (CSP/hydration);
   - `browser_resize` 390x844 + `browser_take_screenshot`;
   - troque o idioma (pt-BR/en) e repita o snapshot.
4. Relate o que foi verificado e o que não foi (por exemplo, sem sessão).
