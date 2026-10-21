---
name: list-layout
description: Decide how a backoffice collection is presented per breakpoint (table, compact list or cards on desktop, tablet and mobile). Use before building or refactoring any listing, table, grid of records or responsive data screen; new-list-screen calls it at the table step.
---

# Apresentação de listagens (desktop, tablet, mobile)

A escolha segue a **tarefa do usuário**, não o tamanho da tela. Decida sem pedir confirmação; justifique em uma linha só quando houver duas opções viáveis.

## 1. Classifique a tela (responda mentalmente)

Objetivo (localizar/agir, comparar, analisar um a um) · volume (poucos vs. dezenas+) · campos essenciais por registro · comparação por coluna é central? · uso operacional repetido? · ações (uma, várias por linha, em massa) · hierarquia (principal vs. secundário).

## 2. Escolha

| Tarefa dominante | Padrão | Sinais |
| --- | --- | --- |
| Localizar e agir | **Lista compacta** | muitos registros parecidos, 2–5 campos identificam o item, ação rápida. Ex.: usuários, clientes, pedidos, faturas |
| Comparar dados | **Tabela** | valores numéricos/financeiros, alinhamento por coluna, ordenação, ações em massa. Ex.: conciliação, estoque, auditoria, relatórios |
| Analisar um a um | **Card** | dados de naturezas diferentes no mesmo registro, decisão por item, ação de destaque, volume baixo. Ex.: aprovações, tarefas |

Desempate: lista × card → mais registros por tela vence (lista). Lista × tabela → tabela só se a comparação por coluna for essencial. Card × tabela → comparativo = tabela, agrupado = card. Empate geral → o mais simples e consistente com o sistema. Contagens orientam, não são regra absoluta. Cards: sem campos demais, sem repetir rótulos óbvios.

## 3. Por breakpoint

- **Desktop (`lg+`)**: tabela é o padrão para dados estruturados; card só se a tarefa for análise individual.
- **Tablet (`md`)**: mantenha a tabela se as colunas prioritárias couberem sem rolagem; senão, use o padrão mobile.
- **Mobile (`< md`)**:
  - lista compacta para "localizar e agir" (não converta toda tabela em card);
  - tabela só se comparar for a tarefa: colunas prioritárias, rolagem horizontal **dentro** do `Table` (o container já tem `overflow-x-auto`), primeira coluna fixa com `sticky left-0 bg-card` quando identificar a linha;
  - card para análise individual.

Defina por escrito no componente quais campos são **prioritários** (sempre visíveis) e **secundários** (detalhe, expansão ou rota de detalhe). Nunca esconda informação ou ação crítica por falta de espaço.

## 4. Implementação

- Uma fonte de dados: mesma query, filtros, ordenação e paginação (URL, `useListParams`, `DataPagination`) para todas as visões. Só a apresentação muda; nada de regra de negócio duplicada.
- Troca por CSS: tabela num wrapper `hidden md:block` e lista com `md:hidden` (sem `useMediaQuery`, evita hydration mismatch). Extraia célula/linha compartilhada para não duplicar formatação, badges e menu de ações.
- Semântica: dados tabulares em `<table>` real (`TableCaption` sr-only, `scope="col"`); coleções em `<ul>/<li>`; card com título em heading.
- Ações por item com o mesmo `DropdownMenu` e `aria-label` com o nome do item; alvo de toque ≥ 44px no mobile; tudo operável por teclado.
- Ações em massa no mobile: checkbox por item + barra de ações fixa; se for inviável, mantenha a tabela.
- Página nunca rola na horizontal; só o componente de tabela.
- Reuse `@ginga/ui` (`Table*`, `Card`, `Badge`, `DropdownMenu`, `Checkbox`). Precisou de primitiva nova genérica? Ela vai para o design system, não para `src/components`.

## Aceite

- [ ] Padrão escolhido por breakpoint registrado em 1 linha (comentário no componente ou no PR).
- [ ] Campos prioritários/secundários explícitos; nada crítico inacessível no mobile.
- [ ] Sem rolagem horizontal da página em 360px; skill `verify-ui` em 360, 768 e 1280px.
