# Playbook para agentes

Índice de decisões: **preciso de X → vá em Y**. As regras invioláveis estão em `AGENTS.md`; as receitas passo a passo em `.claude/skills/` (Claude Code carrega a skill certa pelo pedido).

| Preciso de… | Vá em | Skill |
| --- | --- | --- |
| Tela de listagem/tabela com busca, filtros, paginação | `src/app/(protected)/backoffice/users/page.tsx`, `src/components/list/*` | `new-list-screen` |
| Decidir tabela, lista ou card por breakpoint (nova tela ou refatoração) | `.claude/skills/list-layout/SKILL.md` | `list-layout` |
| Decidir paginação, scroll infinito ou virtualização | `.claude/skills/list-data-strategy/SKILL.md` | `list-data-strategy` |
| Ler/alterar dados de produto | `src/server/members/*` (gateway mock/live), `src/app/api/users/*` | `new-domain-operation` |
| Formulário/diálogo | `src/components/users/role-form-dialog.tsx` | `new-form` |
| Restringir por permissão | `docs/authorization.md`, `src/lib/access`, `<Can>` | `add-permission` |
| Liberar gradualmente/por ambiente | `src/config/flags.ts`, `docs/feature-flags.md` | `add-feature-flag` |
| Tratar código de erro da API | `docs/error-handling.md`, `messages/*/errors.json` | `add-error-code` |
| Começar uma história do Linear, branch, commit ou PR | `docs/workflow.md` (setup), Trunk-Based | `story-workflow` |
| Conferir a tela no navegador | `docs/frontend-verification.md`, MCP `playwright` | `verify-ui` |
| Texto de UI | `messages/pt-BR` e `messages/en`, `useTranslations` | (lint barra literais) |
| Componente visual | `@ginga/ui` (ginga-design-system); faltou algo → evolua o DS, não o produto | |
| Tipos/contrato da API | `npm run api:sync` → `src/lib/api/schema.d.ts` | |
| Configuração/env | `src/config/schema.ts` + `.env.example` (nunca leia `.env`) | |

## Fluxo de trabalho

1. Entenda o pedido em termos de **regra de negócio**; o resto (auth, erros, i18n, lista, permissões, flags, mock) já existe e não deve ser reimplementado.
2. Se a API não tem o endpoint, comece pelo nestjs-boilerplate e sincronize o contrato.
3. Implemente seguindo a skill; use `API_MODE=mock` se a API não estiver rodando.
4. Verifique: `npm run lint && npm run typecheck && npm test`; para UI, a skill `verify-ui`.
5. Relate o que foi verificado, o que não pôde ser e por quê.

## Guardrails automáticos

- **Lint** (`eslint.config.mjs`): texto literal em JSX e labels, `fetch` direto na UI, primitives fora do DS, imports server-only em componentes, `process.env` fora da config, comparação por `message` de erro.
- **Hooks** (`.claude/settings.json`): bloqueiam edição de `.env*`, `vendor/`, lockfile, `contracts/` e tipos gerados; rodam ESLint no arquivo editado.
- **Testes de contrato**: toda permissão e todo código de erro publicados pela API precisam de tradução nos dois idiomas.
- **CI**: lint, tipos, testes, build, `api:check`, segurança e E2E nos três perfis.
