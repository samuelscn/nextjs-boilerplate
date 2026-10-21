<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ginga invariants

Comece por docs/ai-playbook.md (preciso de X → vá em Y) e use as skills de .claude/skills. O foco do produto é regra de negócio: auth, erros, i18n, listas, permissões, flags e mock já existem.


- Este repositório é um template, sem domínio de produto. Use npm e preserve package-lock.json.
- Consulte template.config.json e docs/capabilities.md antes de alterar composição.
- Server Components são o padrão; providers clientes devem estar no menor subtree possível.
- Use @ginga/ui (pacote oficial @ginga-software/ui); não copie primitives nem execute shadcn add.
- Auth exclusivamente por redirect ao Ginga Identity. Password nunca passa pelo produto.
- Tokens só no cookie de sessão HttpOnly selado (JWE A256GCM, `src/server/session/seal.ts`, chaves em `SESSION_SECRETS`); nunca em props/RSC, cookies legíveis, storage do browser ou logs. Secrets são server-only.
- Product API autenticada somente pelo servidor/BFF, base server-only, paths restritos e output Zod.
- Autentique cada operação; layout/proxy e permissões de UI não são autorização. Permissões adaptam a UI (docs/authorization.md): página checa `can(await getAccess(), p)` antes de buscar dados e renderiza `ForbiddenState`; client usa `<Can>`/`useCan`; BFF declara `permission`; navegação declara `permission`.
- Não cachear globalmente dados privados. Sem singleton Query no servidor.
- Valide boundaries com Zod e env em src/config/env.ts; não ler process.env espalhado.
- Preserve CSRF, CSP, cookies, state/nonce/PKCE e fail closed. Leia docs/security.md para mudanças nesses limites.
- Rode lint, typecheck, testes e build; alterações de capability/auth exigem testes dos três perfis.
- Sessão sem estado no servidor: nenhum store/Redis por front. Refresh só no `proxy` (ou `/auth/refresh`); Server Components só leem a sessão.
- I18n é Core obrigatório: todo texto/aria-label de UI deve ser traduzível, via namespaces em messages e next-intl. DS recebe labels/children, nunca depende de next-intl.
- Product API errors seguem RFC 9457 (Problem Details, docs/error-handling.md). Normalize uma vez; decisões por code/status, nunca por title/detail. Código novo da API exige `npm run api:sync` e tradução em errors.json (pt-BR e en).
- Funcionalidade nova ou arriscada nasce atrás de feature flag registrada em src/config/flags.ts (docs/feature-flags.md). Flag decide se existe; permissão decide quem pode.
- Dados de produto passam por um gateway mock/live em src/server/<domínio> (modelo: src/server/members); o mock reproduz contrato e códigos de erro da API.
- Tipos da Product API vêm de src/lib/api/schema.d.ts (gerado do OpenAPI); não escreva DTOs da API à mão nem edite o arquivo gerado.
- Preserve requestId/x-correlation-id validado; nunca mostre mensagens técnicas de 500 ou registre bodies/secrets.
- Mapear details somente para campos conhecidos. Zod no browser é UX; server validation permanece autoridade.
- Não hardcode mensagens de erro nos componentes. Use localizedError/localizedValidation e a política de retry central.

# Verificação de frontend

- Ao criar ou alterar UI, rode `npm run dev` e valide a tela com o MCP `playwright` (`.mcp.json`): snapshot de acessibilidade, estados de loading/vazio/erro, console sem erros, viewport mobile e os dois locales. Detalhes em docs/frontend-verification.md.
- Nunca insira credenciais reais nem contorne o redirect ao Identity pelo MCP.
