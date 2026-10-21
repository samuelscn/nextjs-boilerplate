# Política de dependências

Stable + supported + security patched + tested, não atualização automática para latest. Revisão desta entrega: 14/09/2026. npm exclusivo, versões diretas exatas e package-lock obrigatório. CI usa npm ci. Nenhum override de major, --force, legacy-peer-deps ou exceção de audit é necessário na árvore final.

| Dependência | Versão | Uso/motivo |
| --- | --- | --- |
| Node | 24.21.0 LTS | Runtime suportado; .nvmrc, engines, Docker e CI coerentes |
| Next | 16.3.5 | Runtime App Router/BFF; Active LTS com patches atuais |
| React / DOM | 19.3.0 | Runtime, peer exigida pelo Ginga UI 0.1.7 |
| @ginga/ui → @ginga-software/ui | 0.1.7 | Runtime, DS oficial; tarball local autorizado |
| openid-client | 6.8.8 | Runtime, cliente OAuth/OIDC certificado, PKCE/nonce/state/refresh |
| jose | 6.2.12 | Runtime, verificar access JWT RS256/JWKS do contrato Ginga |
| Zod | 4.6.5 | Runtime, env/input/output boundaries |
| React Hook Form | 7.88.0 | Runtime opcional de forms, estado/validação do formulário |
| @hookform/resolvers | 5.9.1 | Runtime forms, integração RHF/Zod |
| @tanstack/react-query | 5.102.8 | Runtime opcional, estado assíncrono interativo |
| server-only | 0.0.1 | Marcador oficial de fronteira para o compilador Next |
| TypeScript | 6.0.3 | Dev, strict; compatível com typescript-eslint <6.1 |
| ESLint | 10.10.0 | Dev, linha mantida |
| @next/eslint-plugin-next | 16.3.5 | Dev, regras oficiais Next |
| typescript-eslint / react-hooks | 8.70.0 / 7.1.1 | Dev, regras TypeScript e hooks |
| @tanstack/eslint-plugin-query | 5.102.8 | Dev opcional, regras oficiais Query |
| Vitest / jsdom | 4.1.11 / 29.1.1 | Dev, testes unitários/integração/componentes |
| Testing Library React / user-event / jest-dom | 16.3.3 / 14.6.7 / 7.0.1 | Dev, interação e assertions de componentes |
| Playwright | 1.63.0 | Dev, E2E em builds de produção com Chromium |
| husky / lint-staged | 9.1.7 / 17.6.0 | Dev, pre-commit com ESLint nos arquivos staged |
| @commitlint/cli + config-conventional | 21.2.3 | Dev, mensagens de commit em Conventional Commits |
| openapi-typescript | 7.13.0 | Fora do lockfile (npx via scripts/api-sync.mjs): gera tipos do OpenAPI da Product API; peer TypeScript 5 não entra no projeto |
| @playwright/mcp | 0.0.83 | Fora do lockfile (npx via .mcp.json), verificação visual por agentes em dev |
| @types/node / react / react-dom | 24.13.4 / 19.3.0 / 19.3.0 | Dev, tipos do runtime adotado |

Tailwind CSS e @tailwindcss/postcss 4.3.3 são devDependencies diretas para compilar as utilities da aplicação. O CSS dos componentes continua vindo pronto do DS, sem duplicar preflight. Não há Axios, Storybook, shadcn CLI, Redis, Redux/Zustand, libs de datas, analytics ou utilitários de domínio.

ESLint 9 chegou a EOL; eslint-config-next trazia um eslint-plugin-react incompatível com a API ESLint 10. Escolhemos o plugin oficial Next + typescript-eslint + react-hooks sem esse preset, evitando peer override e ferramenta EOL. TypeScript 7 não foi adotado porque o parser atual suporta <6.1; 6.0.3 é testado neste conjunto.

## Escolha das versões

Next 16.2.6 recebido estava vulnerável. O [release de segurança de agosto](https://nextjs.org/blog/august-2026-security-release) corrige problemas críticos a partir de 16.3.3. [16.3.5](https://github.com/vercel/next.js/releases/tag/v16.3.5) adiciona correção de nonce para loading/template e standalone; são motivos concretos para o patch, apesar de recente. [Política de suporte Next](https://nextjs.org/support-policy).

React 19.3.0 é estável e necessário ao DS 0.1.7, não uma atualização por número. [Versões React](https://react.dev/versions) e [advisories React](https://github.com/react/react/security/advisories). Node 24 é Active LTS segundo [calendário oficial](https://github.com/nodejs/Release). [Suporte ESLint](https://eslint.org/version-support/).

O cliente escolhido oferece as funções necessárias sem se tornar IdP: [openid-client](https://github.com/panva/openid-client), [segurança](https://github.com/panva/openid-client/security). Auth.js não foi necessário; Axios não oferece benefício ao fetch nativo. `jose` também sela a sessão no cookie (JWE A256GCM), dispensando store e lock compartilhados.

## Auditoria

Árvore recebida: 15 vulnerabilidades (1 crítica, 11 altas, 1 moderada, 2 baixas). Após remoção do legado e atualização: **0 vulnerabilidades** no audit completo e no audit runtime durante a implementação. O resultado é pontual, não garantia futura.

CI falha em high/critical runtime; o job separado também examina dev dependencies e falha em high/critical da árvore completa. Uma vulnerabilidade de dev deve ser avaliada pelo impacto no build, CI, uso local e cadeia de publicação. Não ignorar ou fazer audit --force. Se precisar de exceção, registrar advisory/CVE, caminho afetado, impacto, evidência de não exploração, mitigação, responsável e data limite de revisão. Não há exceções nesta entrega.

O tarball UI local é imutável e possui integridade no lock; npm audit/Dependabot não consultam uma publicação privada para atualizar esse arquivo. A atualização do DS é manual até migrar ao registry. Não alegamos verificar correspondência binária com a publicação GitHub Packages, que respondeu 401.

## Atualizações

Dependabot semanal para npm, Actions e Docker. Patch/minor por PR; framework e OIDC em grupos próprios; majors permanecem PRs individuais para revisão. Security updates têm grupo separado e prioridade. Nenhum auto-merge.

Toda atualização passa por CI dos três modos, incluindo tipos, testes, build, bundle secret check e E2E. Revise release notes/advisories/peers e semântica de auth/cache. Remova uma dependência quando o custo/superfície exceder o benefício.

Actions estão fixadas em commits verificados dos repositórios oficiais; Dependabot pode propor novos SHAs. CodeQL e Dependency Review complementam audit, sujeitos à disponibilidade GitHub. [Opções Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [CodeQL](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options), [Dependency Review](https://github.com/actions/dependency-review-action).
