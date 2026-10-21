# Permissões no frontend

A Product API é a única autoridade: ela autoriza cada chamada (RBAC com default deny). No frontend, permissões servem para **adaptar a UI** (esconder, desabilitar, explicar) e para o BFF não fazer chamadas que certamente seriam negadas. Nunca use permissões da UI como proteção de dados.

## Fonte

`getAccess()` (`src/server/access`) resolve, uma vez por request (`React.cache`, nunca cache global), as permissões efetivas do usuário:

- `API_MODE=live`: `GET /access/me` da Product API, validado por `myAccessSchema`. Permissões desconhecidas por este build são descartadas.
- `API_MODE=mock` (padrão fora de produção; recusado em produção): `API_MOCK_PERMISSIONS` (`*` = todas, ou lista separada por vírgula) para exercitar telas restritas sem a API.

O tipo `Permission` e o catálogo em runtime vêm do contrato (`contracts/openapi.json`, `npm run api:sync`). Não declare permissões à mão.

## Página (Server Component)

Cheque **antes** de buscar dados, para que um usuário sem acesso não dispare a chamada:

```tsx
const access = await getAccess();
if (!can(access, "member:read")) return <ForbiddenState backHref="/backoffice" />;
const data = await loadMembers(...);
```

`ForbiddenState` explica o 403 sem oferecer login (a sessão é válida) e sem retry. Componentes não importam `@/server/**` (regra de lint): a checagem fica no `page.tsx`/`layout.tsx`.

## Componentes (Client)

O layout do backoffice injeta somente a lista de permissões em `AccessProvider`.

```tsx
<Can permission="member:invite"><InviteUserDialog /></Can>   // esconde
const canAssign = useCan("role:assign");                      // decide no componente
```

Esconda ações de criação/destrutivas; para ações contextuais, prefira `fallback` desabilitado com explicação quando a ausência confundir o usuário.

## Navegação

Itens de `src/config/navigation.ts` declaram `permission`; `Navigation` filtra. A página raiz do backoffice redireciona para o primeiro item permitido e mostra `ForbiddenState` quando não há nenhum.

## BFF

```ts
export const POST = createBffHandler({ method: "POST", permission: "member:invite", input, output, execute });
```

O handler checa sessão, origem e então a permissão (403 `AUTHORIZATION_FORBIDDEN`, Problem Details) antes de `execute`. A API continua autorizando a chamada.

## Erros

403 vindo da API usa `ErrorState`/`localizedError` (`AUTHORIZATION_FORBIDDEN`), mantém a sessão e não redireciona ao login. 401 invalida a sessão e oferece novo login. Veja [error-handling](error-handling.md).

## Testes

Teste o caminho permitido e o negado: navegação sem o item, ação escondida, BFF retornando 403 sem executar. Use `AccessProvider` nos testes de componente e `API_MOCK_PERMISSIONS` no navegador.
