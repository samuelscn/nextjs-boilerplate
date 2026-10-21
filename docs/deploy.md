# Deploy na Vercel

| Ambiente | Gatilho | Como |
| --- | --- | --- |
| homolog | merge na `main` | integração Git da Vercel: deploy *preview* da `main` com domínio fixo de branch |
| produção | release publicada no GitHub para uma tag da `main` | `.github/workflows/deploy-production.yml` (`vercel build --prod` + `vercel deploy --prebuilt --prod`) |

`vercel.json` liga deploys automáticos só para a `main`: PRs não geram preview, porque cada
preview teria uma URL diferente do `APP_URL` e do redirect cadastrado no Identity. A
sessão é selada no cookie (sem store), então serverless e várias instâncias funcionam.

O plano **Hobby** proíbe uso comercial; migre o time para o Pro antes de um produto pago.

## Checklist ao nascer um projeto

1. **Projeto na Vercel**: *Add New → Project*, importe o repositório (framework Next.js;
   a versão do Node vem de `engines` no `package.json`).
2. **Produção fora da `main`**: *Settings → Environments → Production → Branch Tracking*,
   troque a branch de produção para um nome que não existe (ex. `production`). Assim a
   `main` vira preview (homolog) e só o workflow publica produção.
3. **Domínio de homolog**: *Settings → Domains → Add*, ex. `<projeto>-homolog.vercel.app`,
   conectado à Git branch `main`. Produção usa o domínio do projeto (`<projeto>.vercel.app`).
4. **Proteção de deployment**: *Settings → Deployment Protection*. A *Vercel
   Authentication* padrão bloqueia previews (inclusive homolog) para quem não é do time e
   quebra o retorno do login. Desligue-a ou proteja homolog de outra forma.
5. **Identity** (perfis `app`/`backoffice`), em cada ambiente do Ginga Identity:
   - cadastre a application (ver `docs/deploy.md` do ginga-identity): redirect
     `<APP_URL>/auth/callback`, post logout `<APP_URL>/`, `resource` = URL da Product API;
   - adicione `APP_URL` em `TRUSTED_ORIGINS` do Identity.
6. **Variáveis** (tabela abaixo): ambiente *Preview* restrito à branch `main` para homolog e
   *Production* para produção. Nunca reutilize `SESSION_SECRETS` ou client secret entre
   ambientes.
7. **Sentry** (recomendado): projeto Next.js no Sentry; só erros do servidor (render, route handlers, server actions, proxy), sem dados de requisição. Erros do navegador ainda não são enviados (a CSP só permite `connect-src 'self'`).
8. **GitHub**: secret `VERCEL_TOKEN` (*Account Settings → Tokens*) e variáveis
   `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (rode `npx vercel link` localmente e copie de
   `.vercel/project.json`, que não é versionado). Opcional: aprovação manual no
   environment `production`.

## Variáveis por ambiente

| Variável | Perfis | Valor |
| --- | --- | --- |
| `APP_KIND` | todos | `public`, `app` ou `backoffice` |
| `APP_NAME` | todos | nome exibido |
| `APP_URL` | todos | origem HTTPS do ambiente (domínio de homolog ou de produção), sem barra final |
| `I18N_DEFAULT_LOCALE` / `I18N_URL_STRATEGY` | todos | como no `.env.example` |
| `OIDC_ISSUER` | app, backoffice | `https://<identity do ambiente>/api/auth` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_TYPE` / `OIDC_CLIENT_SECRET` | app, backoffice | da application cadastrada no Identity |
| `OIDC_AUDIENCE` | app, backoffice | URL da Product API (igual ao `resource` da application) |
| `SESSION_SECRETS` | app, backoffice | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `API_MODE` / `PRODUCT_API_URL` | backoffice (e app com BFF) | `live` / URL da Product API do ambiente |
| `FEATURE_FLAGS` | opcional | ver `src/config/flags.ts` |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | recomendado | DSN do projeto Sentry do front / `homolog` ou `production`; sem DSN, desligado. Release = commit da Vercel |

Não defina `AUTH_PROVIDER`, `OIDC_ALLOW_HTTP` nem `API_MOCK_PERMISSIONS` fora do desenvolvimento (o build recusa `AUTH_PROVIDER=fake`).

## Produção e rollback

1. `main` verde e homolog validada.
2. Crie a tag `vX.Y.Z` na `main` e publique a release. Pre-releases não implantam.
3. Rollback: *Actions → Deploy production → Run workflow* com uma tag anterior, ou
   *Instant Rollback* no painel da Vercel.
