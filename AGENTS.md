<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ginga invariants

- Este repositório é um template, sem domínio de produto. Use npm e preserve package-lock.json.
- Consulte template.config.json e docs/capabilities.md antes de alterar composição.
- Server Components são o padrão; providers clientes devem estar no menor subtree possível.
- Use @ginga/ui (pacote oficial @ginga-software/ui); não copie primitives nem execute shadcn add.
- Auth exclusivamente por redirect ao Ginga Identity. Password nunca passa pelo produto.
- Tokens/secrets/sessões são server-only. Nunca serializar em props/RSC, cookies com tokens ou storage do browser.
- Product API autenticada somente pelo servidor/BFF, base server-only, paths restritos e output Zod.
- Autentique cada operação; layout/proxy e permissões de UI não são autorização.
- Não cachear globalmente dados privados. Sem singleton Query no servidor.
- Valide boundaries com Zod e env em src/config/env.ts; não ler process.env espalhado.
- Preserve CSRF, CSP, cookies, state/nonce/PKCE e fail closed. Leia docs/security.md para mudanças nesses limites.
- Rode lint, typecheck, testes e build; alterações de capability/auth exigem testes dos três perfis.
- Sessão memory só suporta um processo; não prometer serverless/réplicas sem trocar store e refresh lock.
- I18n é Core obrigatório: todo texto/aria-label de UI deve ser traduzível, via namespaces em messages e next-intl. DS recebe labels/children, nunca depende de next-intl.
- Product API errors seguem ApiErrorResponse. Normalize uma vez; decisões por code/statusCode, nunca compare message. Message não é contrato estável.
- Preserve requestId/x-correlation-id validado; nunca mostre mensagens técnicas de 500 ou registre bodies/secrets.
- Mapear details somente para campos conhecidos. Zod no browser é UX; server validation permanece autoridade.
- Não hardcode mensagens de erro nos componentes. Use localizedError/localizedValidation e a política de retry central.
