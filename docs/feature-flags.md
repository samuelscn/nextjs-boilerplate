# Feature flags e modo de dados

## Feature flags

Registro único em `src/config/flags.ts`. Cada flag tem descrição, dono, data de remoção e um **padrão seguro** (o valor que pode ir para produção sem configuração).

```ts
export const flagDefinitions = {
  rolesEditor: { default: true, description: "…", owner: "platform", removeBy: "2027-06-30" },
} as const satisfies Record<string, FlagDefinition>;
```

Valores por ambiente vêm de `FEATURE_FLAGS` (`rolesEditor=false,outraFlag=true`), validados em `src/config/schema.ts`: nome desconhecido ou valor diferente de `true`/`false` falha a configuração no boot, então erro de digitação nunca passa em silêncio.

| Onde | Como |
| --- | --- |
| Server Component / página | `if (!await isEnabled("rolesEditor")) …` (`src/server/flags.ts`) |
| Client Component | `useFlag("rolesEditor")` ou `<Flag name="rolesEditor" fallback={…}>` |
| BFF | `createBffHandler({ flag: "rolesEditor", … })` responde 404, como se a operação não existisse |
| API | flag equivalente na Product API (`FEATURE_FLAGS` da API) para a operação real |

Flags são resolvidas no servidor uma vez por request; o browser recebe só os booleanos (`FlagsProvider`, hoje no layout do backoffice; adicione no menor subtree que precisar). Sem provider, `useFlag` retorna `false`.

`FlagProvider` é a fronteira para um serviço remoto (Unleash, GrowthBook…): implemente `resolve()` e registre com `setFlagProvider` no bootstrap do servidor, sem mudar call sites.

Ciclo de vida: crie com padrão seguro → ligue por ambiente → quando estável, remova a flag e o código morto até `removeBy`. Flag não substitui permissão: use permissão para *quem* pode, flag para *se a funcionalidade existe*.

### CI/CD

Defina `FEATURE_FLAGS` como variável do ambiente de deploy (GitHub Environments: `vars.FEATURE_FLAGS`) e, se precisar validar os dois estados, adicione o valor à matriz do job. Fora de produção, `GET /api/health` devolve as flags resolvidas e o modo de dados para conferência.

## Modo de dados (`API_MODE`)

| Valor | Uso |
| --- | --- |
| `mock` (padrão fora de produção) | Gateways em memória (`src/server/<domínio>/mock.ts`) com o mesmo contrato e códigos de erro da API. Login continua pelo Identity real. `API_MOCK_PERMISSIONS` define as permissões do usuário logado (`*` = todas). |
| `live` (padrão e único aceito em produção) | Gateways chamam a Product API (`PRODUCT_API_URL`). |

`API_MODE=mock` com `NODE_ENV=production` falha no boot. O shell do backoffice mostra o selo **Dados simulados** no modo mock. Veja [dados](data-fetching.md) para montar um gateway.
