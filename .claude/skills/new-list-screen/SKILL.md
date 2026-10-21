---
name: new-list-screen
description: Build a backoffice list/table screen (search, filters, pagination, row actions) following the reference users screen. Use when asked to create any listing, table, index or management page.
---

# Nova tela de listagem

Modelo executável: `src/app/(protected)/backoffice/users/page.tsx` + `src/components/users/*`. Copie a forma, não o domínio.

## Passos

1. **Contrato**: confirme o endpoint no `contracts/openapi.json` (rode `npm run api:sync` se a API mudou). Use os tipos de `src/lib/api/schema.d.ts`; nunca escreva DTOs da API à mão.
2. **Schemas** em `src/lib/validation/<domínio>.ts`:
   - schema Zod da resposta (projetando só campos públicos);
   - query da URL com `...listParams` e `multiValue(...)` para filtros com vários valores (`src/lib/list/params.ts`).
3. **Gateway** (skill `new-domain-operation`): método `list(query, context)` com `live.ts` e `mock.ts` (mock com dados suficientes para paginar: > 10 itens).
4. **Página** (Server Component):
   - `const access = await getAccess(); if (!can(access, "<recurso>:read")) return <ForbiddenState />;` **antes** de buscar dados;
   - `const query = <schema>.parse(await searchParams)`;
   - `gateway.list(query, await callContext())`.
5. **Toolbar** (client): `SearchInput` (debounce já embutido) + `MultiSelectFilter` + `useListParams().update(...)`. Nunca guarde filtro em `useState`: o estado é a URL.
6. **Tabela**: `Table*` do `@ginga/ui`, `TableCaption` sr-only, `scope="col"`, estado vazio com título/descrição traduzidos, ações por linha em `DropdownMenu` com `aria-label` traduzido incluindo o nome do item.
7. **Paginação**: `<DataPagination page pageSize total />` (links reais, mantém filtros).
8. **Permissões**: ações com `<Can>`/`useCan`; rotas BFF com `permission`; item em `src/config/navigation.ts` com `permission`.
9. **i18n**: todas as chaves em `messages/pt-BR` **e** `messages/en` (o teste de catálogo compara as chaves).
10. **Template**: adicione os novos caminhos ao módulo correto de `template.config.json`.

## Aceite

- [ ] Filtros, busca e página refletem na URL; voltar/avançar e recarregar preservam a tela.
- [ ] Mudar filtro volta para a página 1; página fora do intervalo é ajustada.
- [ ] Usuário sem permissão vê `ForbiddenState`, e a chamada de dados não acontece.
- [ ] Testes: gateway mock (filtros, paginação, erros) + validação da query.
- [ ] `npm run lint && npm run typecheck && npm test` verdes; skill `verify-ui` executada.
