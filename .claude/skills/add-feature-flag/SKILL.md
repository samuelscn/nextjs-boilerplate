---
name: add-feature-flag
description: Put new or risky functionality behind a typed feature flag in the frontend (and the API when it has an endpoint). Use when releasing something gradually or per environment.
---

# Nova feature flag

1. Registre em `src/config/flags.ts` com `default` seguro, `description`, `owner` e `removeBy` (≤ 6 meses).
2. Server: `await isEnabled("nome")`; client: `useFlag("nome")`/`<Flag name>`; BFF: `flag: "nome"` (404 quando desligada).
3. Se houver endpoint na API, registre a mesma flag em `src/feature-flags.ts` do nestjs-boilerplate com `@FeatureFlag("nome")`.
4. Documente o valor por ambiente (`FEATURE_FLAGS`) no PR.
5. Testes nos dois estados (componente com `FlagsProvider`, rota com `isEnabled` mockado).

Remoção: apague a flag do registro, o ramo desligado e os testes do estado antigo até `removeBy`.
