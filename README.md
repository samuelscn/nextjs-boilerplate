# Ginga Next.js Boilerplate

Fundação oficial da Ginga Software para landing pages, aplicações autenticadas e backoffices. Um Core e capabilities opcionais, sem domínio de produto. Projetos novos nascem pela Ginga CLI (`ginga new web <nome> --kind public|app|backoffice`).

## Começar

Requisitos: Node 24.21.0 LTS e npm 11. Para E2E, Chromium do Playwright e OpenSSL; Docker é opcional.

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. O perfil padrão `public` funciona sem Identity ou Product API. Ginga UI 0.1.7 é consumido do tarball oficial local autorizado em vendor; não depende de outro checkout nem de credenciais privadas para instalar. [Proveniência e migração para registry](vendor/README.md).

## Perfis

| APP_KIND | Rotas e capabilities |
| --- | --- |
| public | Página pública, SEO, UI e Core seguro; auth/BFF desabilitados |
| app | /app protegida, OIDC, sessão server-side, BFF |
| backoffice | /backoffice protegida, shell responsivo, navigation e Query Provider |

Ajuste APP_KIND em .env.local. Auth/backoffice exigem registro de application no Ginga Identity, issuer/client/audience e secret para cliente confidencial. Config é validada por Zod conforme capability. Em produção, HTTPS e `SESSION_SECRETS` próprias do ambiente são obrigatórios. [Criar um projeto](docs/creating-a-project.md) · [Capabilities e poda](docs/capabilities.md).

## Stack e arquitetura

Next 16.3.8, React 19.3.0, TypeScript strict, Ginga UI 0.1.7, Zod, RHF e TanStack Query. Versões críticas exatas, npm lockfile e política stable/supported/patched/tested. [Decisões e versões](docs/dependencies.md).

Browser → Next → Product API. Server Components por padrão; browser usa BFF de mesma origem. Ginga Identity autentica por redirect OIDC Authorization Code + PKCE; não recebe senha no Next. A sessão fica selada (JWE) num cookie HttpOnly que o navegador não lê; sem store no servidor. Product API decide autorização. [Arquitetura](docs/architecture.md) · [Autenticação](docs/authentication.md).

`src/app` contém rotas; `src/config` contém env/capabilities; `src/components` contém composição; `src/lib` contém HTTP/validation/query; `src/server` contém auth/session/BFF; `src/providers` contém providers clientes locais.

## Design System

```tsx
import { Button, Input, Card } from "@ginga/ui";
```

O import resolve o pacote real @ginga-software/ui 0.1.7. CSS do DS é importado uma vez por globals.css. A aplicação também compila suas próprias utilities Tailwind v4 pelo plugin em postcss.config.mjs, usando as classes de src. O CSS da lib já inclui preflight e estilos dos componentes: não é necessário escanear o pacote nem importar preflight novamente. Não precisa de shadcn ou tailwind.config.

Use classes completas em className, por exemplo `flex flex-wrap items-center gap-3 md:gap-6`. globals.css conecta os tokens via `@theme inline`: `bg-primary`, `text-primary-foreground`, `border-border` e variantes seguem os mesmos valores dos componentes da lib. Estilos globais ficam nas layers base/components para permitir overrides por utilities. A variante `dark:` acompanha `.dark` em html. Evite montar classes dinamicamente como `bg-${color}`; use um mapa com strings completas.

Branding: sobrescreva tokens em src/app/globals.css, depois do import do DS. Pares suportados: primary/primary-foreground, accent/accent-foreground, background/foreground, card, popover, secondary, muted, destructive, border, input, ring; também radius, font-sans/font-mono, chart-1…5 e sidebar-*. Verifique contraste, foco e light/dark. Sem theme engine adicional ou fontes externas.

## Dados e formulários

Prefira fetch server-side para o primeiro render. Query apenas para estado assíncrono interativo, caching/invalidation/refetch no cliente; provider só no backoffice por padrão. Nenhum cache Query compartilhado entre requests. [Data fetching e BFF](docs/data-fetching.md).

RHF + Zod + fields do Ginga UI; exemplo neutro completo/testado em src/components/forms/example-form.tsx. Ele não cria feature ou endpoint fictício. Inputs são revalidados no servidor/API. [Forms](docs/forms.md).

## Comandos

| Comando | Uso |
| --- | --- |
| npm run dev | Desenvolvimento |
| npm run build | Build standalone + assets |
| npm start | Executar produção standalone |
| npm run lint | ESLint |
| npm run typecheck | Tipos de rotas + TypeScript strict |
| npm test / npm run test:watch | Unitários, componentes e integração OIDC |
| npm run test:e2e | Três perfis em servidores de produção HTTPS locais |
| npm run test:modes | Build separado dos três perfis + secret canary check |
| npm run check | Lint, tipos, testes e build |
| npm run security:check | Invariantes, bundle leak check e audit runtime |
| npm run dev:login | Abre um navegador para você entrar no Identity e salva a sessão do MCP `playwright-session` |
| npm run api:sync | Copia o contrato da Product API (OpenAPI + fixtures de erro) e regenera os tipos |
| npm run api:check | Falha se os tipos gerados estiverem defasados em relação a contracts/ |

Antes de E2E: `npx playwright install --with-deps chromium` e `APP_URL=https://localhost npm run build`. Os testes usam OpenSSL para certificados locais temporários; não desativam validação TLS do app.

Para build/start de smoke:

```sh
APP_URL=https://localhost npm run build
APP_URL=https://localhost npm start
```

O listener é HTTP; HTTPS termina no ingress. Para produção real, use APP_URL correspondente à origem externa e configure env no runtime. Não reutilize configuração HTTP de desenvolvimento em produção. `GET /api/health` é liveness mínimo.

Docker: `APP_URL=https://localhost docker compose up --build -d`. Imagem multi-stage/non-root; Compose read-only/cap_drop, sem .env no contexto. Sessão selada no cookie: réplicas e serverless suportados. [Deployment e configuração](docs/creating-a-project.md).

## Qualidade, CI e segurança

CI verifica public/app/backoffice com npm ci, lint, typecheck, testes, build, segurança e E2E. Security executa audit completo/runtime; CodeQL e Dependency Review estão configurados quando disponíveis. Dependabot semanal npm/Actions/Docker, sem auto-merge de majors. Branch protection, secret scanning e push protection precisam ser habilitados pelos mantenedores; não foram ativados remotamente.

CSP com nonce, HSTS de produção, cookies seguros, CSRF por Origin, URLs restritas, DTOs validados, no-store e logs allowlisted. Sem RBAC/tenant engine, analytics ou state manager global. [Segurança e threat boundaries](docs/security.md) · [Vulnerabilidades](SECURITY.md).

CSP estrita requer renderização dinâmica, inclusive em public; static export não está habilitado. Revogação da sessão do front vale no próximo refresh (até 5 minutos). Testes isolados não substituem homologação com Identity real. [Limites e contrato de auth](docs/authentication.md).

## Ao nascer um projeto

1. Escolha o perfil (`APP_KIND`) e personalize nome, metadata, branding e navegação ([criar projeto](docs/creating-a-project.md)).
2. Deploy na Vercel: homolog na `main`, produção na release do GitHub. Siga o checklist de [deploy](docs/deploy.md): projeto e branch de produção, domínio de homolog, proteção de deployment, application no Identity, variáveis, `VERCEL_TOKEN`.
3. Fluxo de trabalho (Linear, conta bot, ruleset da `main`): [workflow](docs/workflow.md).

## Documentação

[Auditoria](docs/audit.md) · [Arquitetura](docs/architecture.md) · [Autenticação](docs/authentication.md) · [Dados](docs/data-fetching.md) · [Forms](docs/forms.md) · [Segurança](docs/security.md) · [Capabilities](docs/capabilities.md) · [Criar projeto](docs/creating-a-project.md) · [Deploy](docs/deploy.md) · [Dependências](docs/dependencies.md).

O protocolo para agentes está em AGENTS.md. A Ginga CLI gera o repositório, define o perfil (`APP_KIND`) e o nome; a poda de capabilities não usadas ainda é manual ([capabilities](docs/capabilities.md)).
