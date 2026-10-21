# Contrato de erros e localização

Decisões usam **code** (e status). Nunca compare `title`/`detail`/message; não são contrato e não são exibidos. A regra de lint detecta comparações diretas e switch por message.

## Product API: RFC 9457 Problem Details

O contrato é publicado pela API (nestjs-boilerplate) em `contracts/openapi.json` e `contracts/problem-fixtures.json`; `npm run api:sync` copia ambos e regenera `src/lib/api/schema.d.ts` (tipos `ProblemCode`, `Permission`, DTOs). Respostas de erro usam `application/problem+json`:

```ts
interface Problem {
  type?: string;          // URI estável por código
  title?: string;         // inglês, para desenvolvedores; nunca exibido
  status: number;         // igual ao status HTTP
  detail?: string;        // inglês, para desenvolvedores; nunca exibido
  instance?: string;
  code: string;           // identidade estável: decisões e tradução usam só ele
  params?: Record<string, string | number | boolean>; // valores para ICU ({max})
  errors?: { field?: string; code: string; params?: Record<string, string | number | boolean> }[];
  traceId?: string;       // igual a x-correlation-id
  timestamp?: string;
}
```

`problemSchema` (Zod, em `src/lib/http/api-error.ts`) valida limites de tamanho, formato de código, params primitivos e IDs. `normalizeApiError(response)` lê até 64 KiB e verifica `status` do corpo contra o HTTP e a associação dos códigos genéricos; formato inválido ou HTML do ingress vira erro seguro baseado no status, nunca texto do body. Códigos específicos de domínio (`LAST_OWNER_REQUIRED`) passam com qualquer status coerente. `ApiError` expõe `statusCode`, `code`, `params`, `details` (de `errors`) e `requestId` (de `traceId`).

`tests/contract.test.ts` garante que cada fixture publicada é normalizada sem perda e que **todo** código de `ProblemCode`/`FieldProblemCode` do OpenAPI tem tradução em pt-BR e en. Código novo na API → `npm run api:sync`, adicione `errors.CODIGO` nos dois idiomas (com placeholders ICU se houver params) e rode os testes.

| HTTP | Código / comportamento |
| --- | --- |
| 400 | VALIDATION_ERROR: localizar e mapear `errors[]` para campos conhecidos |
| 401 | AUTHENTICATION_REQUIRED: invalidar sessão após rejeição da API; oferecer novo login |
| 403 | AUTHORIZATION_FORBIDDEN: acesso negado; não redirecionar ao login |
| 404 | RESOURCE_NOT_FOUND: mensagem genérica, sem inferir existência/permissões |
| 409 | RESOURCE_CONFLICT ou código específico (ex.: LAST_OWNER_REQUIRED) |
| 422 | DOMAIN_RULE_VIOLATION ou código específico de regra de negócio |
| 429 | RATE_LIMIT_EXCEEDED: aguardar `Retry-After`; sem retry automático |
| 5xx | INTERNAL_SERVER_ERROR/SERVICE_UNAVAILABLE: sempre mensagem genérica |

Nunca traduza por status quando há código específico: dois 409 podem pedir ações diferentes.

## Taxonomia pequena

- ApiError: Problem normalizado.
- NetworkError: fetch não obteve resposta; mensagem errors.NETWORK_ERROR.
- IdentityError: adaptador do boundary de autenticação; somente IDENTITY_UNAVAILABLE ou IDENTITY_FLOW_INVALID, sem espalhar payloads Better Auth/OAuth pela UI.
- UnexpectedError: falha não classificada; mensagem genérica.

HttpError é apenas um adapter interno para criar ApiError a partir de status/código. Não crie hierarquia adicional. A propriedade Error.message contém o código, não texto do backend.

`localizedError(error, t)`: código conhecido → tradução por código com `params` interpolados; código desconhecido → tradução genérica por status. Para 5xx, sempre INTERNAL_SERVER_ERROR, exceto NETWORK_ERROR explícito de comunicação do BFF. Nunca usamos message do backend como fallback visual. `localizedValidation(code, t, params)` segue validation.CODE e cai em validation.INVALID_VALUE; só params primitivos validados são interpolados, nunca frases do backend.

`ErrorState` mostra texto localizado, referência validada e link de login somente quando errorAction é login. 403 não causa logout, login ou retry. Query não dispara redirect global repetidamente.

## BFF, Actions e correlação

`x-correlation-id` é canônico. x-request-id permanece alias de compatibilidade na borda Next. O ID aceita 1–128 caracteres ASCII alfanuméricos, hífen e underscore, começando por alfanumérico. Valor inválido/ausente recebe UUID. Não é dado confiável para autorização nem prova de identidade; operadores podem substituir IDs no ingress confiável.

O BFF envia somente o ID validado à Product API. Em erros, o header retornado tem precedência sobre `traceId` do payload; o ID de saída permanece nos headers, ApiError/DTO e log. Logs aceitam evento, code, statusCode e requestId, não message/body/query/stack. Evite paths se contiverem dados pessoais.

`errorDto(error, requestId)` produz um Problem serializável (allowlist: type, title, status, code, params, errors, traceId, timestamp) para Server Actions. `errorResponse` faz o mesmo em Route Handlers, com `application/problem+json`, status correto e no-store. `detail` nunca é repassado; 5xx não incluem params/errors. Não retorne instâncias Error em props/RSC.

Server Action: autentique e valide fora de qualquer catch que engula redirect/notFound do Next; envolva somente a operação esperada em try/catch e retorne `{ok: false, error: errorDto(error, id)}`. Route Handlers de produto usam createBffHandler. Falhas Zod são convertidas por validationDetails em códigos de detalhe, sem mensagens ou valores recebidos.

Auth faz refresh proativo server-side apenas quando o token está expirando, com lock por sessão. Uma rejeição 401 da Product API invalida a sessão e não repete a operação mutável nem inicia refresh em loop. Novo login é ação explícita da UI ou redirect da próxima rota protegida. 403 mantém a sessão.

## Retry e formulários

Queries: no máximo um retry para NetworkError e HTTP 500/502/503/504; nenhum para erros determinísticos, inesperados, 401/403/404/409/422/429. Mutations: retry false. Retry-After aceita segundos ou HTTP-date, preservado como retryAfterMs e header pelo BFF. Não existe agendamento automático: use o atraso para desabilitar a ação/apresentar espera quando o produto precisar, sem antecipar o prazo.

`applyFieldErrors(details, fields, setError, t)` exige allowlist de FieldPath, ignora fields desconhecidos/prototype paths e duplicados e foca somente o primeiro campo. Zod local usa createExampleSchema com mensagens traduzidas. Após a resposta, o servidor continua sendo autoridade. Veja [forms](forms.md) e [internacionalização](internationalization.md).
