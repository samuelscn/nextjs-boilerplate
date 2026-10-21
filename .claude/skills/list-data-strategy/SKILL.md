---
name: list-data-strategy
description: Decide how a listing loads and renders records — traditional pagination, infinite scroll, virtualization or plain rendering — per device. Use before building or refactoring list pagination, "load more", infinite scroll, long lists or heavy tables; new-list-screen calls it at the pagination step.
---

# Carregamento e renderização de listagens

Duas decisões **independentes**, tomadas separadamente:
- **Busca** (quantos registros pedir e quando): paginação · scroll infinito · tudo de uma vez.
- **Renderização** (quantos nós existem no DOM): convencional · virtualizada.

Escolha a opção mais simples que mantém a tela fluida. Decida sem pedir confirmação; justifique em uma linha quando houver duas opções viáveis.

## 1. Busca

| Situação | Estratégia |
| --- | --- |
| Poucos registros (cabe em 1 página, ~≤ 50) e volume não cresce | Tudo de uma vez, sem paginação |
| Tabela analítica, operação administrativa, usuário precisa ir a uma página, comparar conjuntos, compartilhar link ou agir em massa | **Paginação tradicional** (padrão do boilerplate) |
| Mobile, lista operacional de navegação sequencial ("localizar e agir", feed de pedidos/execuções) | **Scroll infinito** |

- Desktop com tabela: paginação. Mobile com lista compacta (skill `list-layout`): scroll infinito é o padrão; mobile com tabela comparativa: paginação.
- Mesma tela pode usar paginação no desktop e infinito no mobile, com **os mesmos filtros/ordenação/busca da URL**; só `page` muda de papel.
- Filtro, ordenação e busca sempre no backend sobre o conjunto completo. Nunca filtre/ordene só o que já foi carregado.
- Nunca busque todos os registros para paginar ou virtualizar no cliente.

## 2. Renderização

| Situação | Estratégia |
| --- | --- |
| Até ~100 itens no DOM com linhas simples | Convencional (inclui toda tabela paginada com `PAGE_SIZES` ≤ 50) |
| Scroll infinito que acumula centenas de itens, ou linhas caras (muitas colunas, badges, menus, gráficos) | **Virtualização** com overscan pequeno |
| Página única grande (pageSize > 100, exportação, conciliação) | Virtualização, mesmo paginado |

Não virtualize listas pequenas: custo de complexidade, acessibilidade e busca do navegador (Ctrl+F não acha linhas fora do DOM) sem ganho.

## 3. Como implementar no boilerplate

- **Paginação**: o que já existe — página Server Component, query na URL (`listParams`), `gateway.list`, `DataPagination`.
- **Scroll infinito**: 1ª página renderizada no servidor (mesmo gateway); próximas via `useInfiniteQuery` chamando uma rota BFF `GET` com o **mesmo schema Zod da query** e a mesma `permission`. `queryKey` inclui filtros/ordenação/busca: mudou um, a lista reinicia do topo. `page` não vai para a URL no mobile.
  - Use `useInfiniteList` (`src/hooks`) + `LoadMore` (`src/components/list`); modelo: `src/components/users/users-list.tsx`.
  - Prefira cursor se a API oferecer (offset duplica/pula itens quando há inserções); com offset, deduplique por `id` e avance pelo `lastPageParam` (nunca pelo `page` devolvido, que pode prender em loop).
  - Mutação num item: atualize-o no cache (`setQueriesData`) em vez de invalidar todas as páginas carregadas.
  - Gatilho: `IntersectionObserver` num sentinela **e** botão "Carregar mais" visível (fallback de teclado/leitor de tela e erro).
  - Estados: skeleton na 1ª carga, indicador no fim ao buscar a próxima, erro inline com "Tentar novamente" sem perder o que já carregou, mensagem de fim da lista. Contagem anunciada em `aria-live="polite"`; foco não salta ao anexar itens.
  - Memória em sessões longas: `maxPages` no `useInfiniteQuery` (+ virtualização) e `gcTime` adequado; não guarde páginas fora do cache do React Query.
- **Virtualização**: `@tanstack/react-virtual` (ainda não instalado; adicionar ao implementar, alinhado com TanStack Table). Altura estimada estável, overscan ~5–10. Em tabela, mantenha `<table>` real com `aria-rowcount`/`aria-rowindex`; em lista, `aria-setsize`/`aria-posinset`.
- **Voltar do detalhe**: paginação preserva sozinha (URL). O infinito usa `gcTime: 0` (cache antigo não contradiz a página do servidor), então prefira abrir o detalhe em `Sheet` sem sair da lista; se precisar de rota de detalhe, aumente o `gcTime` dessa lista e restaure o scroll (posição em `sessionStorage` por chave da query). Com virtualização, restaure pelo índice do item, não por pixels.

## Aceite

- [ ] Estratégia de busca e de renderização registradas separadamente em 1 linha (comentário ou PR).
- [ ] Filtros/ordenação/busca aplicados no backend e iguais em todas as visões.
- [ ] Infinito: sentinela + botão, erro recuperável, fim da lista, sem duplicados, scroll restaurado ao voltar.
- [ ] Virtualização só quando justificada; leitor de tela anuncia posição/total.
- [ ] `verify-ui` em 360 e 1280px, incluindo carregar mais, erro e retorno do detalhe.
