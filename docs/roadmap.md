# Roadmap: boilerplate pronto para negócio

Objetivo: todo projeto Ginga nasce com login, gestão de usuários e roles, tratamento de permissão e erro, flags, mock e cercas de IA prontos. O time só escreve regra de negócio.

Repositórios: **FE** = nextjs-boilerplate, **API** = nestjs-boilerplate, **DS** = ginga-design-system, **CLI** = ginga-cli. Cada fase termina com commits pequenos (Conventional Commits) e todos os gates verdes do repositório tocado.

## Status (2026-10-20)

| Fase | Situação | Commits |
| --- | --- | --- |
| 1. Contrato de erro (API) | Concluída | API `496ae0f` |
| 2. OpenAPI e consumo no FE | Concluída | API `3ec54de`; FE `6781dbc` |
| 3. Permissões no frontend | Concluída (`GET /access/me`, não `/me/access`; 403 por `ForbiddenState`, pois `forbidden()` ainda é experimental no Next 16.3) | API `6572cf7`; FE `5161ca0` |
| 4. Usuários e roles reais | Concluída (convite por email só no modo `single`) | API `b9a988b`, `7d3df7d`; FE `6a258bc` |
| 5. Flags e modo mock | Concluída, exceto o job de CI `API_MODE=live` contra a API em container | FE `e593a2f`; API `a72aa6b` |
| 6. Cercas de IA | Concluída | FE `55c923a`, `38e3203`; API `e6aafb1` |
| 7. CI/CD e DX | Parcial: toasts, tema, commitlint/lint-staged feitos | FE `2f40da7`, `89dfeb1`; API `27acdab` |

Pendências:

- **Job de contrato live no CI**: subir API + Postgres + Identity fake em container e rodar o E2E do front com `API_MODE=live`. Hoje o contrato é garantido por `openapi:check` (API), `api:check` e `tests/contract.test.ts` (FE) sobre as fixtures publicadas.
- **Observabilidade (OpenTelemetry)**: não implementada. A correlação ponta a ponta já existe por `x-correlation-id` = `traceId`.
- **ginga-cli `new web` / `add resource`**: depende de publicar o nextjs-boilerplate no GitHub e fixar um commit; a poda por perfil (`template.config.json`) precisa reescrever `package.json`/lockfile.
- **Verificação visual com sessão real**: requer `npm run dev:login` feito por uma pessoa.

## Decisões assumidas

Mude aqui antes de começar a fase afetada; o restante do plano depende delas.

| # | Decisão | Valor assumido | Afeta |
| --- | --- | --- | --- |
| D1 | Formato de erro | RFC 9457 (`application/problem+json`) + extensões `code`, `params`, `errors[]`, `traceId` | Fases 1, 2 |
| D2 | Origem de nome/e-mail dos membros | Colunas de perfil no próprio membro, lidas do UserInfo do Identity com o token do chamador em `GET /access/me` | Fase 4 |
| D3 | Tenant | Boilerplate nasce em `AUTHORIZATION_MODE=single`; tenant fica fora deste roadmap | Fases 3, 4 |
| D4 | Feature flags | Variáveis de ambiente tipadas atrás da interface `FlagProvider`; serviço externo depois | Fase 5 |
| D5 | Tradução de erros | No frontend, por `code` + `params`; backend nunca decide o texto exibido | Fases 1, 2 |
| D6 | Mock | Só dados; login continua no Identity real; proibido em produção | Fase 5 |

## Contrato de erro (referência para as Fases 1 e 2)

```jsonc
// HTTP 409, Content-Type: application/problem+json
{
  "type": "https://api.ginga.example/problems/resource-conflict", // URI estável; base em PROBLEM_TYPE_BASE
  "title": "Resource Conflict",          // por tipo, inglês, dev-only
  "status": 409,
  "detail": "A member with this identity already exists.", // por ocorrência, inglês, dev-only; nunca exibido na UI
  "instance": "/access/members",         // path da requisição
  "code": "MEMBER_ALREADY_EXISTS",       // identidade programática, imutável depois de publicado
  "params": { "identityUserId": "…" },   // valores para a mensagem traduzida, só primitivos
  "errors": [                            // só em validação (400)
    { "field": "email", "code": "INVALID_EMAIL" },
    { "field": "age", "code": "MIN_VALUE", "params": { "min": 18 } }
  ],
  "traceId": "req_abc123",               // == x-correlation-id; o mesmo valor do log
  "timestamp": "2026-10-20T21:00:00.000Z"
}
```

Regras:

- **Status**: 400 validação de DTO (`VALIDATION_ERROR`); 401 `AUTHENTICATION_REQUIRED`; 403 `AUTHORIZATION_FORBIDDEN`; 404 `RESOURCE_NOT_FOUND`; 409 conflito; 422 regra de domínio; 429 `RATE_LIMIT_EXCEEDED` com `Retry-After`; 5xx sempre `INTERNAL_SERVER_ERROR` com `detail` genérico. Nunca traduzir por status: dois 409 podem pedir ações diferentes.
- **Códigos** existentes no FE (`AUTHENTICATION_REQUIRED`, `AUTHORIZATION_FORBIDDEN`, `DOMAIN_RULE_VIOLATION` etc.) são mantidos para não quebrar `messages/*/errors.json`. Códigos de domínio novos seguem `RECURSO_CONDIÇÃO` (`MEMBER_ALREADY_EXISTS`).
- **Domínio não conhece HTTP.** Services lançam `DomainError(code, params)`. A camada HTTP traduz para status e Problem Details.
- **Sem vazamento**: nada de stack, SQL, token ou PII em `detail`/`params`. Detalhes ficam no log, ligados ao `traceId`.
- **Desconhecido não quebra**: código sem tradução cai na mensagem genérica do status.
- **Tipos do front vêm do OpenAPI**, não de um pacote compartilhado, para não acoplar o FE ao domínio interno.

---

## Fase 1: Contrato de erro na API (API)

Pré-requisito de tudo o que depende de erros reais.

1. `src/package/shared/module/problem/`: `ErrorCode` (comuns), `DomainError` (code, params, cause), registro `code → status/title`, `ProblemDetails` (tipo), README do módulo.
2. `ProblemExceptionFilter` global (`APP_FILTER`), que cobre `HttpException`, `DomainError`, `AccessError`, `ValidationPipe` e erro desconhecido. Define `Content-Type`, `type`, `instance`, `timestamp` e `traceId`.
3. `ValidationPipe` com `exceptionFactory`: converte `class-validator` em `errors[]` com `field` (caminho aninhado `a.b[0].c`) e `code` estável (`REQUIRED`, `INVALID_EMAIL`, `MIN_VALUE`, `MAX_LENGTH`, …) mais `params`.
4. Unificar correlation: `traceId` = `x-correlation-id` do `LoggingInterceptor`. Remover o `randomUUID` do `authentication-error.filter`, que passa a lançar `DomainError`.
5. Migrar `AccessError` (`forbidden/invalid/not_found/conflict`) para códigos de domínio; remover `access-error.filter` e `authentication-error.filter` depois da migração.
6. `contracts/problem-fixtures.json`: um caso por forma de erro (400 com `errors`, 401, 403, 404, 409, 422, 429, 500). É a fonte dos testes de contrato.
7. Documentar em `docs/CODING-PATTERNS.md` e `AGENTS.md` ("erro novo = adicionar código + status + teste + tradução no FE").

**Aceite**
- E2E por cenário (400/401/403/404/409/422/500) verifica o corpo completo, o `Content-Type` e que o header `x-correlation-id` é igual ao `traceId`.
- Teste garante que 5xx não vaza `detail`, stack ou SQL.
- `npm run lint`, `build`, unitários, integração e E2E verdes.

## Fase 2: OpenAPI e consumo no FE (API + FE)

1. **API**: `@nestjs/swagger`, decorators nos controllers e DTOs, schema `ProblemDetails` e enum dos códigos públicos em `components`. Script `npm run openapi:export` gera `openapi.json`. Opcionalmente servir `/docs` fora de produção.
2. **FE**: `src/lib/http/problem.ts` substitui `apiErrorSchema` por `problemSchema` (Zod). A classe `ApiError` mantém `statusCode`, `code`, `details` (agora de `errors[]`), `params` e `requestId` (de `traceId`); sem mudar os call sites.
3. **FE**: `normalizeApiError` aceita `application/problem+json`; checa `status` do corpo contra o HTTP; formato inválido ou HTML do ingress vira erro seguro por status.
4. **FE**: `localizedError` passa `params` ao `next-intl` (ICU) e cai no genérico por status se o código for desconhecido. `localizedValidation` consome `errors[].code` + `params`.
5. **FE**: `errorDto` (BFF → browser) usa o mesmo formato Problem Details com allowlist (`type`, `code`, `status`, `params`, `errors`, `traceId`) e remove `detail` em 5xx.
6. **FE**: `npm run api:sync` copia `openapi.json` e `problem-fixtures.json` da API para `contracts/`; `npm run api:types` gera tipos (`openapi-typescript`). Um passo de CI falha se o gerado estiver defasado.
7. **FE**: teste de catálogo: todo código público do OpenAPI tem tradução em `pt-BR` e `en`.
8. Atualizar `docs/error-handling.md` e `docs/data-fetching.md`.

**Aceite**
- Os fixtures da API passam no `problemSchema` do FE e produzem a mensagem localizada esperada nos dois idiomas.
- Código desconhecido mostra o genérico por status.
- Teste de catálogo e `api:types` sem diff.

## Fase 3: Permissões no frontend (API + FE)

1. **API**: `GET /me/access` → `{ userId, roleIds, permissions[] }` (permissões efetivas); `GET /access/permissions` → catálogo agrupado por recurso (para a tela de roles). Ambos em OpenAPI e com E2E.
2. **FE server**: `getAccess()` (cache por requisição com `React.cache`, nunca global), `can(p)`, `requirePermission(p)`. Falta de permissão renderiza a página 403 (`forbidden()`/`forbidden.tsx` se estável no Next 16.3; senão componente próprio) com ações de voltar e trocar de conta.
3. **FE client**: `AccessProvider` recebe só `permissions[]` já resolvido (menor subtree), `<Can permission>` e `useCan()`.
4. **FE navegação**: `navigation.ts` ganha `permission` por item; o `Navigation` filtra.
5. **FE ações**: botões sem permissão ficam ocultos (criar/excluir) ou desabilitados com tooltip (ações contextuais). Um 403 vindo da API mostra o `ErrorState` localizado, sem redirecionar ao login (regra já existente).
6. Tipos de `Permission` vêm do OpenAPI; sem lista duplicada à mão.
7. `docs/authorization.md` no FE: "UI não é autorização", como proteger rota, ação e navegação.

**Aceite**
- Testes dos três perfis (`public`, `app`, `backoffice`), como pede o `AGENTS.md`.
- E2E com usuário sem `member:read`: menu sem Usuários, acesso direto à URL mostra a página 403, e a API continua negando.

## Fase 4: Gestão real de usuários e roles (API + FE)

1. **API** (D2): `member_profile` (`identityUserId`, `name`, `email`, `lastAccessAt`, `status`), migration pelo script do projeto, upsert no primeiro login autenticado a partir dos claims; `GET /access/members` passa a devolver perfil + roles; paginação, busca e filtros multivalor no servidor (`page`, `pageSize`, `q`, `role[]`, `status[]`) com `total`.
2. **API**: invariantes (não remover o último admin, não suspender a si mesmo) como `DomainError` 422 com código próprio.
3. **FE**: trocar `usersStore` pelo adaptador real via `productRequest` + cliente gerado; manter o contrato `list/invite/changeRole/changeStatus`. A tela atual, com URL params, debounce e paginação, é preservada.
4. **FE**: tela de **Roles** com CRUD, matriz de permissões agrupada por recurso e atribuição; rotas BFF com `requirePermission`.
5. Traduções dos códigos de domínio novos em `errors.json` (pt-BR/en).

**Aceite**: E2E ponta a ponta contra a API real (convidar, mudar role, tentar remover o último admin → mensagem localizada), e testes de permissão por role.

## Fase 5: Feature flags e modo mock (FE + API)

1. **Registro tipado** `src/config/flags.ts` (FE) e `src/config/flags.ts` (API): nome, tipo, padrão, descrição, `owner`, data de remoção. Validado por Zod no boot.
2. **`FlagProvider`**: implementação `env` (`FEATURE_FLAGS=a=true,b=false` mais overrides por ambiente). Avaliação sempre no servidor; o client recebe valores resolvidos via `FlagsProvider`, com `<Flag name>` e `useFlag()`.
3. **API**: `FlagsService` + `@FeatureFlag("x")` (guard que responde 404 `RESOURCE_NOT_FOUND` quando desligada).
4. **Modo de dados** `API_MODE=mock|live` (FE), validado em `src/config/env.ts`. `productRequest` escolhe o adaptador por operação. O mock responde exatamente o contrato do OpenAPI, com fixtures tipadas.
5. **Guarda de produção**: `API_MODE=mock` com `NODE_ENV=production` falha no boot (fail closed, como o fake de identidade da API). `/api/health` expõe o modo e as flags ativas apenas fora de produção.
6. Indicador visual de "modo mock" no shell em desenvolvimento.
7. **CI/CD**: matriz do CI com `API_MODE=mock` (rápido, sem API) e job `contract` com `API_MODE=live` contra a API em container; flags passadas por variável do job; documentar o procedimento de remover flag vencida.

**Aceite**: testes de que flag desligada esconde UI e rota; mock em produção falha no boot; E2E roda nos dois modos com o mesmo conjunto de specs.

## Fase 6: Cercas de IA (FE + API)

1. `.claude/skills/` no FE: `new-list-screen`, `new-form`, `new-bff-endpoint`, `add-permission`, `add-error-code`, `add-feature-flag`, `new-page-i18n`. Cada uma com passos, arquivos-modelo (a tela de usuários) e checklist de aceite.
2. `.claude/skills/` na API: `new-package`, `new-endpoint` (controller + DTO + OpenAPI + erro + teste), `add-error-code`, `add-permission`.
3. `.claude/settings.json` versionado: permissões de leitura seguras e hooks (pós-edição roda lint e typecheck; bloqueio de edição em `.env*`, `vendor/`, lockfile e arquivos gerados).
4. Regras de lint próprias no FE: `process.env` só em `config/env.ts`; sem texto literal em JSX; sem `fetch` fora de `bffRequest`; sem comparar `message` de erro; sem import de primitives fora de `@ginga/ui`. Equivalentes na API (controller não importa repository; sem `console`).
5. `docs/ai-playbook.md` em cada repo: tabela "preciso de X → vá em Y". Atualizar `AGENTS.md` e `CLAUDE.md`.
6. Login de desenvolvimento para o Playwright MCP: script que autentica um usuário de teste no Identity local e salva `storageState` (gitignored), usado pelo MCP e pelo E2E autenticado.

**Aceite**: um prompt de teste ("criar tela de listagem de X com permissão Y") produz código que passa lint, typecheck e testes sem correção manual; hooks bloqueiam as edições proibidas.

## Fase 7: CI/CD e DX (FE + API + CLI)

1. CI: OpenAPI e `contracts/` sincronizados, teste de contrato, catálogo de traduções, matriz mock/live, commitlint, lint-staged no pre-commit.
2. Toasts (Sonner) com helper `notifyError(error)` que usa o mesmo `localizedError`; tema claro/escuro persistido.
3. Observabilidade: OpenTelemetry em `instrumentation.ts` (FE) e na API, `traceId` propagado FE → BFF → API → logs; gancho opcional de Sentry.
4. **CLI**: `ginga new --kind public|app|backoffice` aplica a poda do `template.config.json`; `ginga add resource <nome>` gera a partir das skills (schema, rota BFF, tela, i18n, testes, mock, permissão). Atualizar `docs/creating-a-project.md`.
5. Corrigir em `docs/creating-a-project.md` a frase "Não adicionar users/orders/etc como modelo de template": gestão de usuários e roles faz parte do perfil `backoffice` por decisão do produto.

---

## Ordem de execução

```
Fase 1 (API) → Fase 2 (API+FE) → Fase 3 (API+FE) → Fase 4 (API+FE) → Fase 5
                    Fase 6 acompanha cada fase (a skill nasce com a capacidade)
                    Fase 7 ao final; observabilidade pode entrar a qualquer momento depois da Fase 2
```

Início paralelizável: a Fase 3 (lado FE) pode começar contra o fake de identidade assim que a Fase 2 estiver pronta. A Fase 4 só começa depois da D2 confirmada.

## Riscos

- **Quebra de contrato na migração da Fase 2**: trocar `apiErrorSchema` mexe em todo o tratamento de erro do FE; os testes atuais de `i18n-errors` e `components` são a rede de segurança, então devem passar sem alteração de expectativa além do formato do corpo.
- **Códigos publicados são imutáveis**: renomear exige código novo e período de convivência; o teste de catálogo e o OpenAPI sincronizado detectam remoções.
- **`member_profile` desatualizado**: nome/e-mail mudam no Identity; a Fase 4 define a regra de refresh no login e documenta que a lista reflete o último acesso.
- **Mock divergente da API**: mitigado por gerar o mock a partir do OpenAPI e pelo job `contract` em modo live.
