# Auditoria da base recebida — 14/09/2026

Inspeção realizada antes da implementação. A cópia recebida não disponibilizava um repositório Git operacional; não é possível atestar histórico, commits ou alterações anteriores. Os arquivos originais foram preservados fora do projeto durante a limpeza. Nenhum valor do arquivo de ambiente foi reproduzido.

| Área original | Classificação | Decisão |
| --- | --- | --- |
| Next 16.2.6, React/DOM 19.2.4, App Router | CORE_REUSABLE / SECURITY_RISK | Manter App Router, aplicar versões corrigidas e compatíveis com DS |
| npm workspaces, app administrativo e UI interna | NEEDS_REFACTOR | Uma aplicação em src; Design System como dependência |
| Telas administrativas, gerenciamento de contas/permissões, painel | PRODUCT_SPECIFIC | Remover páginas, modelos, hooks de negócio e APIs correspondentes |
| Senha, recuperação e reset recebidos pelo produto | SECURITY_RISK / LEGACY | Remover; OIDC redireciona exclusivamente ao Identity |
| Proxy que verifica existência/nome de cookie | SECURITY_RISK | Verificar sessão server-side antes de cada operação protegida |
| Encaminhamento de cookies e headers para serviço externo | SECURITY_RISK | Cookie opaco local e Bearer exclusivamente server-side |
| Branding remoto, tenants, flags, logos e assets | PRODUCT_SPECIFIC | Remover; semantic tokens do DS |
| HTTP fetch e erros, RHF/Zod, Query Provider | CORE_REUSABLE / NEEDS_REFACTOR | Preservar conceitos; adicionar boundaries, limites e validação |
| Componentes internos shadcn e Storybook/builds gerados | LEGACY | Remover duplicação; consumir pacote oficial |
| TypeScript strict, ESLint flat config | CORE_REUSABLE | Atualizar e reforçar opções de segurança |
| Tailwind v4/PostCSS | IMPLEMENTED | Utilities da aplicação compiladas por PostCSS; tokens conectados ao DS, sem repetir preflight |
| Docker/Compose | CORE_REUSABLE / NEEDS_REFACTOR | Standalone, non-root, sem env no build context |
| Variável única de backend, .env local | PRODUCT_SPECIFIC / SECURITY_RISK | Remover do projeto; validação contextual e .env.example |
| Testes, CI, automação de segurança | NEEDS_REFACTOR | Ausentes na árvore de fontes recebida; implementar |

Não foram encontrados stores globais próprios ou infraestrutura de deploy além de Docker/Compose. Provider Query estava no root; será limitado à capability apropriada. O root layout já era Server Component, mas carregava branding por API. Não havia server-side session OIDC, refresh lifecycle ou testes de autenticação.

Auditoria NPM do lock original: **15 vulnerabilidades** (1 crítica, 11 altas, 1 moderada, 2 baixas), 636 dependências reportadas. Next estava afetado por advisories de bypass/SSRF/DoS e advisories críticos corrigidos na linha 16.3.3. A árvore de Storybook também trazia dependências vulneráveis desnecessárias ao boilerplate. Ver docs/dependencies.md para a decisão final e fontes oficiais. Nomes, URLs e detalhes de domínio anteriores foram deliberadamente omitidos deste registro.

## Validação final — 14/09/2026

| Gate executado | Resultado |
| --- | --- |
| npm ci | Instalação reproduzível, incluindo UI 0.1.4 local |
| npm run lint / npm run typecheck | Aprovados, sem warnings de lint |
| npm test | 83 testes em 6 arquivos aprovados |
| npm run test:modes | Builds separados de public, app e backoffice aprovados |
| npm run test:e2e | 6 testes Chromium em produção HTTPS, três perfis aprovados |
| npm run security:check | Invariantes, secret canaries nos bundles e audit runtime aprovados |
| npm audit | Zero vulnerabilidades na árvore completa; nenhuma exceção |
| npm run build / npm start | Standalone funcionando; página e health com HTTP 200 |
| Docker build e runtime | Build aprovado; smoke non-root (UID 1000), read-only, cap_drop=ALL |
| YAML de CI/security/CodeQL/Dependabot/Compose | Parsing aprovado; execução remota depende do GitHub |

Revisão de risco cobriu state/nonce/PKCE/issuer/assinatura/audience, callback de uso único, open redirect, refresh concorrente e logout durante refresh, CSRF, caminhos SSRF, DTOs sem tokens, server-only, cache privado e CSP. A revisão encontrou e corrigiu um lock de refresh que poderia permanecer após falha síncrona; há teste de regressão. A loading boundary foi movida para dentro do layout protegido para preservar o redirect HTTP antes de streaming. E2E também rejeita erros de CSP/hydration no console.

Os testes OIDC usam a biblioteca real e assinaturas/JWKS de teste com transporte controlado. Os E2E verificam o redirect para uma fixture mínima de Discovery, não um login completo em Identity real. Homologação com cliente/serviço reais permanece necessária. Sessões exigem processo único, e o pacote UI local não foi comparado à publicação privada. Secret scanning, push protection e proteções de branch não foram ativados remotamente. A varredura final de fontes não encontrou nomes, branding, TODOs ou dependências do produto original.
