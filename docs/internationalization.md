# Internacionalização (Core obrigatório)

Todos os perfis usam **next-intl 4.14.5**, sem transformar páginas/layouts em Client Components. O pacote declara peers compatíveis com Next 16 e React 19. Foram consultados [App Router](https://next-intl.dev/docs/getting-started/app-router), [Server/Client Components](https://next-intl.dev/docs/environments/server-client-components), [release notes](https://github.com/amannn/next-intl/releases/tag/v4.14.5) e [advisories](https://github.com/amannn/next-intl/security/advisories). É um patch estável da linha mantida, fixado no lock e validado neste conjunto. Não habilitamos precompilação experimental de mensagens nem carregamos catálogos externos.

## Configuração e URLs

- `I18N_DEFAULT_LOCALE=pt-BR`: default validado por Zod; também suporta `en`.
- `I18N_URL_STRATEGY=public-prefix`: páginas públicas usam /pt-BR e /en. App/backoffice mantêm /app e /backoffice, com preferência de idioma por cookie.
- `I18N_URL_STRATEGY=cookie`: URLs sem prefixo também no público; adequado quando SEO multilíngue não é necessário.
- Sem env, defaults vêm de `template.config.json.i18n`. A CLI deve preservar i18n como Core, selecionar estratégia e default, nunca podar a infraestrutura de tradução.

A resolução pura está em `src/i18n/config.ts`: locale explícito válido → preferência de usuário validada, quando fornecida por código confiável → cookie válido → Accept-Language ponderado → default. Na implementação atual a preferência persistida é o cookie; não inventamos um endpoint de perfil nem claim do Identity. Quando o produto tiver idioma persistido no backend, resolva-o no servidor e forneça-o ao resolvedor antes do cookie, sem consultar a API no Proxy.

Headers de locale/path enviados pelo browser são sobrescritos pelo Proxy. A allowlist é `supportedLocales`; não há import interpolado com locale arbitrário. Tags não suportadas nunca viram nomes de arquivo. Accept-Language tem limite de tamanho/itens, ignora pesos inválidos e usa fallback de idioma base. Cookie inválido é ignorado.

O Proxy combina os redirects/rewrites de páginas públicas com os headers CSP existentes. /en reescreve internamente para a página pública existente, sem duplicar árvore ou sistema de tradução. Endpoints /api, /auth, rotas protegidas, assets, robots e sitemap não recebem prefixo. /en/auth/callback não é alias de callback. URL pública explícita ganha do cookie. URLs inexistentes mostram 404 traduzido.

`POST /api/locale` valida Origin, Content-Type, tamanho, locale e returnTo. Cookie host-only HttpOnly, Secure em HTTPS, SameSite=Lax, um ano. A troca faz navegação completa, atualizando RSC, traduções de validação e caches Query. Não é uma credencial nem autoridade de autorização. Labels do seletor são autônimos linguísticos centralizados, não textos de produto.

## Catálogos e componentes

```text
messages/
  pt-BR/ common.json errors.json auth.json validation.json public.json backoffice.json forms.json
  en/    common.json errors.json auth.json validation.json public.json backoffice.json forms.json
src/i18n/
  config.ts catalogs.ts request.ts errors.ts client-provider.tsx emergency.ts
```

Namespaces pequenos e keys estáveis: common.actions.save, auth.applicationTitle, errors.AUTHENTICATION_REQUIRED. Use ICU para valores/plurais; nunca construa HTML de traduções externas.

Server Component async: `await getTranslations("auth")`. Componente compartilhado/síncrono: `useTranslations("common")`, sem adicionar use client apenas para traduzir. Client Component: o mesmo hook sob IntlProvider. Os filhos do provider continuam RSC; apenas mensagens públicas são serializadas. Catálogos atuais são pequenos; produtos grandes devem fornecer somente namespaces necessários aos subtrees clientes.

Metadata usa locale, descrição traduzida, OpenGraph, canonical e alternates/hreflang no público com prefixo. Sitemap lista URLs de cada locale. Cookie-only não anuncia URLs duplicadas como traduções independentes. Dados/HTML seguem no-store, evitando resposta privada ou idioma incorreto em cache compartilhado.

404, erros de segmento, Identity, feedback e forms usam os mesmos namespaces. Global error não depende do provider que pode ter falhado: usa next-intl com catálogos emergenciais common/errors. Recupera locale da URL ou último provider montado; se o root falhar antes disso, usa o default do manifesto (não depende de leitura de env no client). Ao escolher outro default permanente, atualize também o manifesto, não apenas o override de runtime.

## Adicionar locale

1. Atualize supportedLocales, localeNames e o enum do schema do manifesto.
2. Adicione os arquivos de namespace e registre imports explícitos em catalogs.ts/emergency.ts.
3. Complete as mesmas keys; os testes verificam paridade e traduções/fluxos nos dois idiomas iniciais.
4. Configure o default se necessário e rode os gates.

Não altere componentes ao adicionar idiomas. Ginga UI recebe children, labels, mensagens e aria-labels traduzidos; não depende de next-intl. Primitives sem textos de aplicação continuam sob responsabilidade do DS.
