# Criar um projeto manualmente

Até existir a Ginga CLI, use este repositório como template privado. Não copie node_modules, .next, .env, caches ou histórico do projeto de origem.

## Instalar e iniciar

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

O tarball oficial local Ginga UI 0.1.4 está incluído para reprodução. Não é necessário acesso ao GitHub Packages nesta configuração. Leia vendor/README.md antes de migrar a dependência para o registry.

## Landing/site público

Deixe APP_KIND=public. Configure APP_NAME e APP_URL. Não precisa de Identity, client secret, sessão ou API. Edite src/app/page.tsx, metadata e icon. Branding fica em semantic tokens de src/app/globals.css. A poda opcional está descrita em capabilities.md.

## Aplicação autenticada

Defina APP_KIND=app. Cadastre a application no Ginga Identity e forneça OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_TYPE, OIDC_CLIENT_SECRET quando confidential, OIDC_AUDIENCE. Use o redirect exato APP_URL/auth/callback e post logout APP_URL/. O resource da application precisa estar permitido no Identity.

Localmente, é permitido HTTP loopback com OIDC_ALLOW_HTTP=true e NODE_ENV fora de produção. Nunca usar bypass TLS ou esse flag em produção. Configure PRODUCT_API_URL somente ao integrar uma operação real. Backend é autoridade de autorização.

## Backoffice

Siga a configuração autenticada com APP_KIND=backoffice. Edite src/config/navigation.ts e componha páginas no grupo protegido. Shell, Query Provider e estados neutros já existem. Não adicionar users/orders/etc como modelo de template.

## Produção

APP_URL é a origem HTTPS externa. Não use .env.local de desenvolvimento como configuração de produção. Em auth/backoffice, SESSION_SINGLE_PROCESS=true declara a única topologia suportada pelo store atual. Injete todas as variáveis necessárias no ambiente de build quando validar um perfil e no runtime. O Docker faz build público sem secrets e seleciona o perfil no runtime.

```sh
APP_URL=https://localhost npm run build
APP_URL=https://localhost npm start
```

Esses comandos usam uma origem local HTTPS de smoke: o listener Node continua HTTP; TLS deve terminar no ingress. Em deploy real, substitua APP_URL pela origem cadastrada. Portas/HOSTNAME são variáveis de infraestrutura lidas pelo servidor Next, não configuração pública. O build exige URL HTTPS quando NODE_ENV=production.

```sh
APP_URL=https://localhost docker compose up --build -d
```

Compose expõe apenas 127.0.0.1:3000, usa non-root/read-only/cap_drop e precisa de TLS ingress. Para um host externo configure sua origem real. Não copiar .env para imagem. Para replicas/serverless, primeiro substitua o store/refresh lock: a configuração atual não suporta isso.

## Antes de publicar o produto

Configure branch protection, secret scanning/push protection e checks required; habilite CodeQL/Dependency Review quando contratados; defina canal de responsible disclosure em SECURITY.md. Execute os gates e valide OIDC real no ambiente homologado. Personalize metadata, páginas, navegação e contatos. Veja security.md e dependencies.md.
