---
name: new-domain-operation
description: Add a Product API operation end to end in the frontend - gateway (live + mock), BFF route, schemas, permission and errors. Use when a screen needs to read or change product data.
---

# Nova operação de produto (gateway mock/live + BFF)

Modelo: `src/server/members/{gateway,live,mock,index}.ts` e `src/app/api/users/*/route.ts`.

## Passos

1. `npm run api:sync`: o endpoint precisa existir em `contracts/openapi.json`. Se não existir, a operação começa na API (nestjs-boilerplate, skill `new-endpoint`).
2. Schemas Zod em `src/lib/validation/<domínio>.ts` para entrada (com mensagens por código via `createXSchema(t)`) e saída.
3. `src/server/<domínio>/gateway.ts`: interface com `context: CallContext`.
4. `live.ts`: `productRequest(path, schema, { method, body, query, requestId })`. Paths fixos no código; ids só como segmentos validados (uuid). `204` → schema `z.unknown()`.
5. `mock.ts`: estado em memória com o **mesmo contrato e os mesmos códigos de erro** (`new HttpError(409, "CODIGO")`). Reproduza as invariantes que a UI precisa exibir.
6. `index.ts`: escolha por `getAuthEnv().API_MODE`.
7. Rota BFF `src/app/api/<domínio>/<operação>/route.ts` com `createBffHandler({ method, permission, flag?, input, output, execute })`. Nunca crie proxy genérico.
8. Client: `bffRequest(path, schema, { method, body })` dentro de `useMutation`; `router.refresh()` no sucesso; erros por `ErrorState`/`applyFieldErrors`.

## Aceite

- [ ] Teste do mock cobrindo sucesso e cada código de erro exposto.
- [ ] Teste de rota quando houver regra própria (permissão/flag já são cobertas pelo helper).
- [ ] Nada de `fetch` direto em componentes (o lint barra).
