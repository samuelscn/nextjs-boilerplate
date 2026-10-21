# Dados e mutações

| Necessidade | Padrão |
| --- | --- |
| Dados necessários no primeiro render | Server Component + função server-only |
| Leitura autenticada na Product API | productRequest no servidor, no-store |
| Cache/refetch/invalidation interativos no browser | TanStack Query + rota BFF nomeada |
| Form específico com navegação/revalidação integrada | Server Action validada e autenticada |
| Contrato JSON, múltiplos clientes ou Query | Route Handler/BFF |

Server Components chamam a função de servidor diretamente, sem fazer uma chamada HTTP ao próprio /api. O browser usa `bffRequest` com caminhos /api locais e credentials same-origin. Nunca recebe a base URL privada nem o Bearer token.

## HTTP mínimo

`productRequest(path, schema, options)` recebe caminho definido no código do servidor. A base vem exclusivamente de PRODUCT_API_URL. Não há rota catch-all. A construção conserva host e prefixo da base; rejeita URLs externas, ponto, percent-encoding, barras invertidas e caminhos ambíguos. Query strings usam URLSearchParams e não alteram o destino.

Headers de entrada, cookies do browser, Set-Cookie e Location da API não são repassados. Apenas Authorization server-side, Accept, content-type quando necessário e x-correlation-id validado são enviados. Fetch usa no-store, redirect:error e timeout de 10 segundos. Erros passam por normalizeApiError; mensagens técnicas não são retornadas ao browser. Não repetir automaticamente operações mutáveis.

Respostas JSON são limitadas a 1 MiB e validadas por Zod. Use z.object com somente os campos públicos necessários; nunca z.any/z.unknown/passthrough para projetar resposta de produto ao browser. Campos extras são removidos. Uma proteção adicional rejeita reflexão do access token e nomes de campos de credenciais.

## Montar uma operação de produto: gateway mock/live

Operações de produto ficam atrás de um **gateway** por domínio em `src/server/<domínio>/` com duas implementações do mesmo contrato:

- `live.ts`: chama `productRequest` com os caminhos e schemas do contrato (`contracts/openapi.json`; tipos em `src/lib/api/schema.d.ts`).
- `mock.ts`: estado em memória do processo, com o mesmo formato de resposta e os **mesmos códigos de erro** da API (por exemplo `LAST_OWNER_REQUIRED`), para que UI e tratamento de erro se comportem igual nos dois modos.
- `index.ts`: escolhe pelo `API_MODE` (`mock` por padrão fora de produção; recusado em produção) e expõe `callContext()` (sujeito da sessão + requestId).

Referência completa: `src/server/members` (usuários e roles). Páginas e rotas BFF dependem só da interface do gateway:

```ts
// src/app/api/<domínio>/<operação>/route.ts
export const POST = createBffHandler({
  method: "POST", permission: "member:invite", input: inviteSchema, output: memberSchema,
  execute: async (input, requestId) => membersGateway().invite(input!, await callContext(requestId)),
});
```

O helper valida método, capability, Origin em mutações, sessão, permissão declarada, body de até 16 KiB e saída. A Product API valida e autoriza novamente. Respostas `204 No Content` são aceitas quando o schema admite corpo ausente (`z.unknown()`).

Server Actions devem tratar FormData como unknown, validar schema, chamar requireSession e então productRequest. Cookies/Origin padrão do Next não dispensam validação/autorização. Use revalidatePath somente para conteúdo com uma política de cache revisada; não habilite cache global para dados privados.

## TanStack Query

A factory cria um QueryClient novo. O provider mantém uma instância por montagem e está apenas no layout backoffice. App/public podem adicionar esse provider ao menor subtree interativo quando necessário. Não há singleton SSR, persistência em storage, devtools ou refetch global agressivo.

Defaults: staleTime 30s, gcTime 5min, sem refetch no foco; no máximo um retry para NetworkError ou HTTP 500/502/503/504. Nenhum retry para erros determinísticos, inesperados, 4xx ou mutations. 429 preserva Retry-After como retryAfterMs para UX explícita, sem repetição automática. Adicione signal do queryFn ao bffRequest para cancelamento.

Uma mutation bem-sucedida invalida a query específica com `queryClient.invalidateQueries({ queryKey })`. Query keys devem separar usuário/contexto quando houver troca de identidade sem reload. O logout padrão navega o documento inteiro. Se mudar esse fluxo para SPA, cancele queries, limpe o cache e renove a árvore antes de trocar usuário.

Para hydration, use createQueryClient por request + prefetchQuery/dehydrate/HydrationBoundary e passe só DTOs permitidos. Não desidrate objetos de sessão internos. Não carregue a mesma informação por RSC e Query sem definir a responsabilidade de atualização.

401 invalida sessão após rejeição da API e oferece novo login; não faz refresh/replay infinito. 403 mantém sessão e mostra acesso negado. ErrorState traduz por code, preserva requestId e nunca exibe message técnica. Route Handlers e Server Actions usam errorResponse/errorDto; detalhes de validação chegam aos campos via applyFieldErrors. Veja [erros](error-handling.md) e [i18n](internationalization.md).
