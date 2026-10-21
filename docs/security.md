# Segurança

## Invariantes

1. Tokens nunca vão para localStorage/sessionStorage.
2. Refresh token nunca chega ao JavaScript do browser.
3. Browser não chama Product API autenticada diretamente por padrão.
4. PRODUCT_API_URL é server-only.
5. Não existe proxy com destino arbitrário.
6. Redirects são internos validados ou endpoints confiáveis de Discovery.
7. Secrets, sessão e credenciais são server-only.
8. Dados autenticados não são cacheados globalmente.
9. Permissões de UI não autorizam operações; Product API é autoridade.
10. Password nunca passa pelo frontend do produto.

## Controles e limites

| Ameaça | Controle | Responsabilidade restante |
| --- | --- | --- |
| Auth bypass | Sessão validada no servidor por operação; JWT assinado; fail closed | API valida/autorização novamente |
| Callback manipulation | State/nonce/PKCE, iss obrigatório, assinatura, audience, callback exato e uso único | Registrar redirects exatos no Identity |
| CSRF | POST logout e BFF mutável exigem Origin exata; Sec-Fetch-Site cross/same-site negado; SameSite=Lax | XSS na mesma origem continua ameaça |
| XSS | React escaping, sem HTML externo, CSP com nonce, inputs Zod | Sanitizar HTML caso um produto introduza essa capacidade |
| SSRF | Host/base configurados; caminhos restritos; redirects externos negados; Discovery/JWKS same-origin | Proteger configuração, DNS e egress; não usar URLs remotas vindas do browser |
| Open redirect | Caminhos internos conservadores; endpoints Identity validados | Novos destinos precisam revisão |
| Session theft | Cookie selado (JWE A256GCM) HttpOnly/Secure/host-only; TTL absoluto que o refresh não estende; chaves por ambiente com rotação | TLS, sigilo de `SESSION_SECRETS`, segurança do host e ingress; revogação vale no próximo refresh (até 5 min) |
| Leakage/cache | DTO mínimo; no-store; nenhuma credencial em RSC; schemas de saída | Não adicionar use cache ou caches compartilhados sobre dados privados |
| DoS | Limites de memória/body/resposta; timeouts; refresh único por sessão | Rate limit, timeout de leitura e limite de conexão no ingress |
| Supply chain | Pins, lockfile, npm audit, Dependency Review, CodeQL, Actions por SHA | Revisão humana, registry privado e controle de acesso |

## CSP e headers

Proxy gera nonce criptograficamente aleatório por resposta e o envia ao renderer do Next no header de request. Sobrescreve nonce e headers internos de locale/path. Correlation ID é validado ou gerado; não usa proxy/locale/correlation ID como fonte de autorização.

Scripts: self + nonce + strict-dynamic; nenhum unsafe-inline ou unsafe-eval em produção. Development permite unsafe-eval para o Next. Styles: self + unsafe-inline, exceção explícita para atributos/posicionamento dos primitives Base UI do DS. Isso não habilita scripts inline. Não há wildcard de host. Imagens self/data, fonts self, connect-src self, object/base/frame restritos.

form-action permite self e, só em auth, a origem exata do Identity para redirects de RP logout. OIDC usa navegação do documento, não CORS/fetch no browser. X-Frame-Options DENY, nosniff, Referrer-Policy same-origin e Permissions-Policy restritiva completam a política. HSTS de um ano em produção sem includeSubDomains/preload: não assumir autoridade sobre outros hosts.

Referrer-Policy same-origin preserva Origin nos POSTs nativos de logout/idioma e omite Referer para destinos externos, incluindo Identity. Dentro da mesma origem, Referer pode conter path/query; nunca o registre. no-referrer fazia o browser enviar Origin: null nesses formulários, causando 403 mesmo com APP_URL correto. A proteção CSRF continua exigindo Origin exatamente igual a APP_URL e rejeitando Origin ausente/null e Sec-Fetch-Site cross-site/same-site. Não derive a origem confiável de Host/Forwarded nem aceite null como fallback. APP_URL deve corresponder à origem externa (protocolo, host e porta) usada pelo navegador.

A CSP com nonce torna páginas dinâmicas e incompatíveis com CDN cache de HTML/ISR estático. Não remova nonce nem acrescente unsafe-inline aos scripts para obter cache. Assets estáticos com hash podem ser cacheados pelo Next. O E2E verifica CSP, nonce do HTML, cookies e renderização real.

## Sessões e cookies

Cookies __Host-* em HTTPS/produção, sem Domain, Path=/, HttpOnly, Secure e SameSite=Lax. Em HTTP local fora de produção, nomes sem prefixo e sem Secure. Max-Age da transação: 600 segundos. Sessão: no máximo 8 horas. Não existe cookie compartilhado entre produtos e Identity.

Sessão selada no cookie não exige store e suporta réplicas e serverless. Custos aceitos: quem obtém `SESSION_SECRETS` forja sessões daquela aplicação (chaves só no ambiente, nunca no repositório, uma por ambiente e aplicação); um cookie copiado vale até o teto absoluto ou até o próximo refresh falhar; não há revogação instantânea da sessão do front (a Product API autoriza cada chamada).

Logout local invalida imediatamente. Revogação remota é best effort e falhas são registradas sem token. Ausência de back-channel logout significa que encerramento da sessão Identity não necessariamente remove a sessão local até refresh/expiração. Veja [autenticação](authentication.md).

## Logs e secrets

Logger aceita somente nomes fixos de evento, statusCode, código de erro e requestId com formato validado. Não aceita objetos arbitrários, mensagens externas ou bodies. Nunca registrar Authorization, Cookie, Set-Cookie, authorization code OAuth, tokens, secrets ou passwords. x-correlation-id válido pode ser preservado; valor inválido vira UUID. Um ID vindo do browser serve somente para correlação, nunca autenticação.

I18n valida locales antes de carregar catálogos por imports explícitos. Troca de locale é POST com Origin, limite de body e redirect interno. Somente nessa operação, os destinos exatos /auth/error e /auth/signed-out são permitidos como páginas informativas; ações /auth/login, /auth/logout, /auth/callback e endpoints /api continuam proibidos como retorno. Catálogos locais são confiáveis, mas inputs interpolados continuam não confiáveis; não renderizar HTML externo. Mensagens de API/Identity não são renderizadas diretamente: code → tradução; 500 é genérico. Payload de erro tem limite de 64 KiB e schema Zod, e DTOs do BFF removem message/details técnicos. Veja [erros](error-handling.md).

Desabilitamos logging de URLs de entrada do Next. Configure também ingress/APM para não armazenar query de /auth/callback, headers sensíveis nem bodies. Não habilitar debug HTTP de bibliotecas OIDC em produção. Secrets ficam no ambiente do servidor ou secret manager; .env está ignorado e excluído do Docker context. Nenhuma env deste boilerplate tem prefixo NEXT_PUBLIC_.

Env é validado em instrumentation no startup Node e ao acessar configuração. Erros só exibem nomes de campos, sem valores ou mensagens que os incluam. HTTPS é obrigatório em produção. Health não consulta Identity nem API e não expõe configuração; é liveness, não readiness completa.

## Dependências e GitHub

security:check verifica invariantes de código e marcadores de secrets nos bundles e executa audit runtime. Não é um scanner genérico de secrets nem prova matemática de ausência de vazamento. Build e testes de DTO/OIDC complementam essa checagem. Segurança de dependências usa também CodeQL/Dependency Review quando o plano do GitHub permite.

Configure no GitHub: proteção de main, revisão obrigatória, impedir push direto, CI dos três perfis e Security/audit como checks requeridos; Dependabot alerts/security updates; secret scanning e push protection. CodeQL e Dependency Review em repositórios privados dependem do plano e de habilitação; depois configure variables CODEQL_ENABLED=true e DEPENDENCY_REVIEW_ENABLED=true. Os workflows não afirmam habilitar configurações administrativas.

Não habilitamos essas opções remotamente nesta execução; arquivos não substituem repository settings. Não adicionamos Gitleaks duplicado. Se secret scanning nativo não estiver disponível no ambiente escolhido, avalie Gitleaks oficial em CI como controle alternativo antes do primeiro deploy. Responsável pelo recebimento de vulnerabilidades deve ser configurado conforme SECURITY.md.

## Review obrigatório por mudança

Revise auth/CSRF, entradas Zod, paths/redirects, headers, cache, saída RSC, logs, escopos e dependências afetados. Nunca mescle com CI falhando. Exceções de audit precisam advisory, impacto, evidência de não exploração, mitigação, responsável e data de revisão; não há exceções abertas nesta entrega.
