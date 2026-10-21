---
name: add-error-code
description: Handle a new Product API problem code in the frontend (translation, params, UI decision). Use when the API adds or returns a new error code.
---

# Novo código de erro

O contrato é RFC 9457 (docs/error-handling.md). Decisões e textos usam só `code` (+ `params`).

1. `npm run api:sync` (o código precisa estar no enum `ProblemCode` do OpenAPI).
2. Adicione `errors.<CODIGO>` em `messages/pt-BR/errors.json` **e** `messages/en/errors.json`. Se a API envia `params`, use placeholders ICU com os mesmos nomes (`{max}`).
3. Se o mock de algum gateway reproduz a condição, lance `new HttpError(status, "CODIGO")` nele.
4. A UI decide por `error.code` (nunca por `title`/`detail`). Na maioria dos casos `ErrorState`/`localizedError` já basta.

Aceite: `npx vitest run tests/contract.test.ts` verde (ele falha se faltar tradução de código publicado).
