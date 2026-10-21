# Capabilities e contrato do template

`template.config.json` (schemaVersion 1, schema local template.schema.json) é o contrato pequeno para geração futura. APP_KIND seleciona o perfil durante desenvolvimento/validação. A Ginga CLI (`ginga new web --kind`) já define o perfil padrão; a poda abaixo ainda não é automática.

| Perfil | Public core/UI/SEO | Auth/session | BFF | Query provider | Forms de referência | Shell |
| --- | --- | --- | --- | --- | --- | --- |
| public | Sim | Não | Não | Não | Opcional | Não |
| app | Sim | Sim | Sim | Opcional | Opcional | Não |
| backoffice | Sim | Sim | Sim | Sim | Sim | Sim |

O backoffice exige autenticação, mesmo quando não há Product API. Nenhuma configuração desliga autenticação mantendo backoffice. O root redireciona app para /app e backoffice para /backoffice. Public responde 404 para endpoints auth/session e páginas protegidas. Em public, configuração ignora e não exige variáveis de auth. BFF só acessa uma Product API quando uma operação real for integrada; por isso PRODUCT_API_URL pode estar ausente.

## Manifesto

- defaultKind: perfil usado sem APP_KIND.
- profiles: conjunto de capabilities por perfil; backoffice depende de auth+bff e query.
- modules: arquivos/diretórios candidatos à poda e dependencies/devDependencies correspondentes.
- $schema: validação editorial do formato. Paths são relativos ao root; nunca fora dele.

O manifesto é inventário, não um programa de remoção automática: imports e composição precisam ser transformados conforme a seção seguinte. CI executa builds dos três perfis. A factory `capabilities(kind)` retorna os valores declarados. i18n.required=true declara Core obrigatório; selecione i18n.defaultLocale e estratégia, mas preserve next-intl, src/i18n, messages, /api/locale e o provider de traduções em todos os perfis.

## Poda (manual; futura automação da CLI)

Comuns: copiar template sem artifacts/.git/.env, definir nome no package.json, APP_NAME, APP_URL e defaultKind, selecionar perfil, personalizar metadata/icon/tokens, instalar com npm ci e manter lockfile. Não gerar credenciais ou URLs de produção fictícias. Não registrar clients em startup. O pacote UI local deve ser mantido com integridade ou substituído pela mesma versão publicada com acesso autorizado ao registry.

Public:

1. Manter root page pública, globals, erros, SEO, config core, validation/http comuns, security headers, testing e CI.
2. Remover módulos auth/bff/backoffice/query/forms conforme modules se não usados: rotas protegidas/auth/api-session, server auth/session/api, componentes auth/shell/forms, provider/query e exemplo de schema.
3. Ajustar src/config/schema.ts para schema core-only; remover AuthEnvironment/getAuthEnv e configurações OIDC/session. Remover branch de redirect em app/page.tsx e branches privadas em metadata/robots/sitemap/proxy.
4. Remover dependências dos módulos podados e plugin Query/import no ESLint. Zod e server-only continuam Core.
5. Podar os testes exclusivos de auth/query/forms, tests/helpers.ts e fixture de Discovery; manter unitários core, component/error e E2E público. Reduzir matriz e manifesto ao conjunto do projeto gerado.
6. Regenerar lock com npm install, validar npm ci e gates públicos.

App: manter auth/session/BFF, páginas auth e /app; remover backoffice, navigation e o subtree correspondente. Query/forms são opt-in locais: remover módulos/dependências/exemplos não utilizados. Registrar application no Identity por operação autorizada com redirect e resource exatos e configurar secret server-only. Fixar defaultKind=app e simplificar branches de perfil.

Backoffice: manter auth/BFF/shell/query; remover página /app não usada, fixar defaultKind=backoffice, configurar navigation e páginas reais. Manter form de referência somente até criar formulários do produto. Não gerar features de domínio, RBAC ou tenants. A única exceção é a tela de referência de gestão de usuários e roles (`/backoffice/users`): ela usa um adaptador em memória (`src/server/users/store.ts`) atrás das rotas BFF `/api/users/*`, apenas para demonstrar o layout. Usuários, roles e permissões pertencem à Product API; troque o adaptador por `productRequest()` com schemas Zod antes de usar em produção.

Após poda, nenhum import pode apontar a módulo removido. A CLI deverá executar lint/typecheck/tests/build e smoke de produção, e revisar o lockfile. Não usar exclusão por string global que possa atingir paths fora do projeto. Redis/DB/analytics são capacidades futuras; i18n já faz parte do Core. Ao podar auth/forms/backoffice, remova também namespaces/imports exclusivos e mantenha common/errors/validation/public conforme uso.
