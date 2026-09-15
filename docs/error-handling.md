# Contrato de erros e localização

Decisões usam **code** e statusCode. Nunca compare message; ela não é contrato estável e pode variar por idioma. A regra de lint detecta comparações diretas e switch por message.

## Product API

`src/lib/http/api-error.ts` contém ApiErrorResponse, ApiErrorDetail e schemas Zod:

```ts
interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: { field?: string; code: string; message: string }[];
  requestId?: string;
  timestamp: string;
  path?: string;
}
```

Timestamp aceita ISO 8601 com Z ou offset explícito, compatível com new Date().toISOString(). Sem timezone ou datas inválidas são rejeitadas. Códigos aceitam uppercase/snake-case até 96 caracteres, incluindo novos códigos de domínio. Há limites para mensagens, details, field, path e requestId. Campos extras não são propagados.

`normalizeApiError(response)` lê até 64 KiB, valida payload, status HTTP versus statusCode e a associação dos códigos principais. Formato inválido vira erro seguro baseado no status HTTP, nunca texto do body. HTTP 401/403 continua distinguível mesmo quando um ingress devolve HTML. Não fabricar NetworkError para uma resposta HTTP 500.

| HTTP | Código / comportamento |
| --- | --- |
| 400 | VALIDATION_ERROR: localizar e mapear details para campos conhecidos |
| 401 | AUTHENTICATION_REQUIRED: invalidar sessão após rejeição da API; oferecer novo login |
| 403 | AUTHORIZATION_FORBIDDEN: acesso negado; não redirecionar ao login |
| 404 | RESOURCE_NOT_FOUND: mensagem genérica, sem inferir existência/permissões |
| 409 | RESOURCE_CONFLICT: código de domínio específico quando traduzido, senão genérico |
| 422 | DOMAIN_RULE_VIOLATION: input estruturalmente válido, regra de domínio negou operação |
| 429 | RATE_LIMIT_EXCEEDED: aguardar; sem retry automático |
| 500 | INTERNAL_SERVER_ERROR: sempre genérico, sem detalhes técnicos |

## Taxonomia pequena

- ApiError: resposta HTTP normalizada, com statusCode/code/details/requestId/timestamp/path.
- NetworkError: fetch não obteve resposta; mensagem errors.NETWORK_ERROR.
- IdentityError: adaptador do boundary de autenticação; somente IDENTITY_UNAVAILABLE ou IDENTITY_FLOW_INVALID, sem espalhar payloads Better Auth/OAuth pela UI.
- UnexpectedError: falha não classificada; mensagem genérica.

HttpError é apenas um adapter interno para criar ApiError a partir de status/código. Não crie hierarquia adicional. A propriedade Error.message contém um código seguro, não o texto técnico do backend.

`localizedError(error, t)`: código conhecido → tradução por código; código desconhecido → tradução genérica por status. Para 5xx, sempre INTERNAL_SERVER_ERROR, exceto NETWORK_ERROR explícito de comunicação do BFF. Nunca usamos message do backend como fallback visual. `localizedValidation` segue validation.CODE e cai em validation.INVALID_VALUE, sem interpolar frases não confiáveis.

`ErrorState` mostra texto localizado, referência validada e link de login somente quando errorAction é login. 403 não causa logout, login ou retry. Query não dispara redirect global repetidamente.

## BFF, Actions e correlação

`x-correlation-id` é canônico. x-request-id permanece alias de compatibilidade na borda Next. O ID aceita 1–128 caracteres ASCII alfanuméricos, hífen e underscore, começando por alfanumérico. Valor inválido/ausente recebe UUID. Não é dado confiável para autorização nem prova de identidade; operadores podem substituir IDs no ingress confiável.

O BFF envia somente o ID validado à Product API. Em erros, o header retornado tem precedência sobre requestId do payload; o ID de saída permanece nos headers, ApiError/DTO e log. Logs aceitam evento, code, statusCode e requestId, não message/body/query/stack. Evite paths se contiverem dados pessoais.

`errorDto(error, requestId)` produz objeto serializável coerente para Server Actions. `errorResponse` faz o mesmo em Route Handlers, com status correto e no-store. Mensagens e detalhes técnicos são removidos; 5xx não incluem details/path. Não retorne instâncias Error em props/RSC.

Server Action: autentique e valide fora de qualquer catch que engula redirect/notFound do Next; envolva somente a operação esperada em try/catch e retorne `{ok: false, error: errorDto(error, id)}`. Route Handlers de produto usam createBffHandler. Falhas Zod são convertidas por validationDetails em códigos de detalhe, sem mensagens ou valores recebidos.

Auth faz refresh proativo server-side apenas quando o token está expirando, com lock por sessão. Uma rejeição 401 da Product API invalida a sessão e não repete a operação mutável nem inicia refresh em loop. Novo login é ação explícita da UI ou redirect da próxima rota protegida. 403 mantém a sessão.

## Retry e formulários

Queries: no máximo um retry para NetworkError e HTTP 500/502/503/504; nenhum para erros determinísticos, inesperados, 401/403/404/409/422/429. Mutations: retry false. Retry-After aceita segundos ou HTTP-date, preservado como retryAfterMs e header pelo BFF. Não existe agendamento automático: use o atraso para desabilitar a ação/apresentar espera quando o produto precisar, sem antecipar o prazo.

`applyFieldErrors(details, fields, setError, t)` exige allowlist de FieldPath, ignora fields desconhecidos/prototype paths e duplicados e foca somente o primeiro campo. Zod local usa createExampleSchema com mensagens traduzidas. Após a resposta, o servidor continua sendo autoridade. Veja [forms](forms.md) e [internacionalização](internationalization.md).
