---
name: add-permission
description: Use a new or existing permission to adapt UI, navigation and BFF routes. Use when a feature must be restricted to some users.
---

# Permissões

A API autoriza tudo; o frontend só adapta a UI (docs/authorization.md).

1. Permissão nova nasce na API (`definePermissions` no nestjs-boilerplate) → `npm run api:sync`. O tipo `Permission` vem do contrato.
2. Rótulos em `messages/*/backoffice.json` → `permissions.<recurso>.<ação>` e `permissions.<recurso>.label` (o teste de contrato exige).
3. Página: `if (!can(await getAccess(), "<p>")) return <ForbiddenState />` antes dos dados.
4. Client: `<Can permission>` ou `useCan` (esconda criação/remoção; explique ações contextuais).
5. BFF: `createBffHandler({ permission: "<p>", ... })`.
6. Navegação: `permission` no item de `src/config/navigation.ts`.
7. Teste os dois lados com `API_MOCK_PERMISSIONS` (navegador) e `AccessProvider` (componentes).
