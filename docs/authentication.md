# Autenticação com Ginga Identity

Contrato inspecionado no código local do Ginga Identity: `src/auth/auth.ts`, `src/applications/service.ts`, `examples/client.ts` e testes OAuth. O Identity é Better Auth + OAuth Provider; o produto é um relying party OIDC. Não instalar Better Auth como segundo IdP no produto.

## Configurar uma application

Cadastre pelo procedimento operacional do Identity uma application com:

- tipo `confidential` preferencialmente (`client_secret_basic`), ou `public` explicitamente registrado (`none`);
- redirect exato `APP_URL/auth/callback`;
- post logout redirect exato `APP_URL/`;
- resource autorizado correspondente à audience da Product API;
- Authorization Code, refresh e PKCE obrigatório.

Os nomes `OIDC_ISSUER`, `OIDC_CLIENT_ID` e `OIDC_AUDIENCE` já são usados pelo cliente existente do Identity; foram preservados. Este BFF adiciona `OIDC_CLIENT_TYPE` e `OIDC_CLIENT_SECRET`. Não duplicamos variáveis equivalentes com outro prefixo.

`OIDC_ISSUER` inclui `/api/auth`. A biblioteca resolve Discovery, authorization/token/JWKS e logout; nenhum desses endpoints é hardcoded no produto. `OIDC_AUDIENCE` vira o parâmetro OAuth `resource`, tanto na autorização quanto em token/refresh. Ela não precisa ser igual a PRODUCT_API_URL, que pode incluir prefixo de caminho.

Não registre automaticamente clients nem altere o Identity ao iniciar o Next. O bootstrap de applications pertence ao processo operacional/futura CLI. Credenciais confidenciais são entregues por canal seguro, nunca no terminal do browser ou no Git.

## Biblioteca e fluxo

`openid-client@6.8.8` é o cliente maduro, mantido e certificado escolhido. Executa Authorization Code, state, nonce, PKCE S256, validação OIDC, refresh, revogação e construção de logout. Ativamos também `enableNonRepudiationChecks` para validar a assinatura do ID token. `jose` valida o access token do contrato Ginga: RS256, issuer, audience, subject, azp, iat e exp. Não implementamos protocolo ou criptografia OAuth.

`GET /auth/login` gera valores aleatórios por tentativa. state/nonce/verifier e o destino vão selados (JWE) num cookie independente por até 10 minutos. Prefetch não inicia login. O destino posterior passa por uma allowlist estrutural de caminhos internos; endpoints auth/api são rejeitados.

`GET /auth/callback` abre a transação selada e apaga o cookie; o uso único vem do code de uso único ligado ao PKCE no Identity. Exige code, state e iss únicos, confere issuer e estado, e delega nonce, PKCE e assinaturas à biblioteca. Falha de qualquer validação nega o fluxo. Host/Forwarded do request não determinam o redirect_uri: ele deriva de APP_URL. O sucesso substitui a sessão anterior por uma nova.

Escopos padrão: `openid offline_access`. Profile/email não são solicitados sem necessidade. Somente `{ user: { id }, expiresAt }` sai de getSession/API; ID/access/refresh tokens nunca aparecem em props ou RSC.

## Sessão e refresh

A sessão não tem estado no servidor: subject, access token, refresh token e expirações vão selados num único cookie (JWE `dir` + `A256GCM`, `src/server/session/seal.ts`). O navegador não lê nem altera o conteúdo; adulteração, chave desconhecida ou expiração equivalem a "sem sessão". Funciona com qualquer número de instâncias (Vercel/serverless, réplicas) sem Redis ou store por front. O par de tokens do Ginga Identity fica perto de 1,6 KB selado; acima de 3.800 bytes o login falha com o log `session.too_large`.

Cookie host-only HttpOnly, SameSite=Lax, Path=/, Secure em HTTPS e sempre em produção; prefixo `__Host-` no modo seguro. TTL absoluto padrão de 8 horas, configurável de 5 minutos a 8 horas; o refresh nunca estende esse teto.

Chaves: `SESSION_SECRETS` com uma ou mais chaves base64url de 32 bytes separadas por vírgula. A primeira sela, todas abrem: para rotacionar, coloque a nova na frente e remova a antiga depois de `SESSION_TTL_SECONDS`. Use chaves diferentes por ambiente e por aplicação; vazamento de uma chave permite forjar sessões daquela aplicação.

Refresh acontece no `proxy` quando faltam menos de 60 segundos para o access token expirar, só em requisições cuja resposta o navegador guarda: páginas e `/api/*`, nunca `/auth/*`, arquivos estáticos, prefetches ou navegações iniciadas por outro site (`Sec-Fetch-Site: cross-site`). Um token rotacionado cuja resposta se perde é reusado depois da janela do Identity e revoga a família, por isso esses gatilhos ficam de fora; requisições simultâneas da mesma instância compartilham um único refresh. Quando renova, o cookie novo vai na resposta e também na requisição encaminhada, para que a mesma renderização já leia a sessão renovada. Server Components nunca fazem refresh, porque não podem gravar cookie e um refresh token rotacionado não persistido derrubaria a sessão; se uma renderização encontrar sessão vencida, `requireSession` redireciona para `GET /auth/refresh` (que, vindo de outro site, manda ao login em vez de renovar). A rotação deve retornar novo refresh token; subject não pode mudar. Revogação, expiração ou indisponibilidade encerram a sessão (cookie apagado).

Instâncias paralelas podem renovar ao mesmo tempo com o mesmo refresh token. O Ginga Identity devolve a mesma resposta a reusos em até 30 segundos (`refreshTokenReuseInterval`); fora dessa janela trata como roubo e revoga a família. Por isso não há lock local de refresh.

Sem store não há revogação imediata da sessão do front: suspender usuário ou revogar grants no Identity vale no próximo refresh (até 5 minutos). A Product API continua autorizando cada chamada. Novo login revoga o refresh token da sessão substituída. Logout revoga o refresh token no Identity mesmo com a sessão já expirada e apaga os cookies; revogação remota é best effort e JWT já emitido pode continuar válido até expirar. Uma renovação concorrente exatamente durante o logout pode regravar a sessão com o token rotacionado; o risco é aceito e limitado ao teto absoluto da sessão.

## Proteger páginas e operações

```tsx
import { requireSession } from "@/server/auth";

export default async function Page() {
  const session = await requireSession("/app");
  return <p>Sessão de {session.user.id}</p>;
}
```

Layouts verificam sessão, mas não são a única fronteira: cada operação/handler que acessa dados privados autentica novamente. React layouts podem persistir entre navegações. O proxy configura headers, não concede acesso. Não use apenas existência de cookie ou verificação client-side.

`GET /api/session` responde 401 após expiração. Uma API responde 401 em vez de retornar HTML de login; a interface apresenta novo acesso. `requireSession` redireciona páginas para login.

## Logout local e Identity

`POST /auth/logout` exige Origin exata. Remove sessão local e cookies e tenta revogar o refresh token. A navegação completa também descarta os caches Query do documento. GET não realiza logout.

`POST /auth/logout?identity=true` adiciona RP-Initiated Logout pelo endpoint de Discovery. Envia apenas client_id e o redirect cadastrado, sem id_token_hint. O provider Ginga atual suporta esse fluxo com confirmação no Identity. Não promete encerrar sessões locais de outros produtos. Se Identity estiver indisponível, a página signed-out explica que apenas o logout local foi concluído.

`OIDC_MAX_AGE` permite solicitar autenticação recente e exige auth_time correspondente no ID token. Não implica MFA: o Identity atual não disponibiliza esse contrato. Futuras políticas MFA/ACR devem ser integradas e validadas quando o IdP as suportar; não inventar garantias de MFA no front.

## Desenvolvimento e testes reais

HTTP somente em loopback fora de produção, com `OIDC_ALLOW_HTTP=true`. APP_URL local pode ser http://localhost:3000; Identity local costuma usar http://localhost:4000/api/auth. Configure a audience cadastrada, sem assumir que é a origem do Next.

Testes unitários mockam o cliente por interface; testes de integração usam a biblioteca real contra respostas/JWKS assinados gerados no teste. E2E inicia Next em produção e usa apenas um stub de Discovery/redirect, sem falso servidor de tokens. Isso não substitui testar login e consentimento no Ginga Identity real.

Nesta execução, o serviço local Identity não estava disponível. Para homologar: disponibilize Identity e application cadastrada, execute login pelo produto, confirme consentimento, visite a página protegida, aguarde expiração do access token, valide refresh e execute ambos os logouts. Observe que cookies/Network do produto não contêm access/refresh. Não grave traces/HAR com credenciais reais.
