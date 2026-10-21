"use client";
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { bffRequest } from "@/lib/http/browser";
import { toSearchParams, type ParamValue } from "@/lib/list/params";

type ListPage<T> = { items: T[]; total: number; page: number; pageSize: number };

// Incremental loading for a list whose filters live in the URL (skill list-data-strategy).
// Filters/search/sort are the query key, so changing any of them restarts from the top; `page` is owned here.
// `initial` (server-rendered page 1) avoids a client fetch on first paint. `enabled` keeps hidden views idle.
export function useInfiniteList<T extends { id: string }>({ key, path, schema, query, initial, enabled = true }: {
  key: string; path: string; schema: z.ZodType<ListPage<T>>;
  query: Record<string, ParamValue>; initial?: ListPage<T>; enabled?: boolean;
}) {
  const filters = useMemo(() => Object.fromEntries(Object.entries(query).filter(([name]) => name !== "page")), [query]);
  // `schema` is fixed per `path`, which is already part of the key.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const result = useInfiniteQuery({
    queryKey: [key, path, filters],
    queryFn: ({ pageParam, signal }) => bffRequest(path, schema, { query: toSearchParams({ ...filters, page: pageParam }), signal }),
    initialPageParam: 1,
    // Advance from the requested page, not the echoed one: a server that clamps or ignores `page` cannot loop.
    getNextPageParam: (last, _pages, lastPage) => lastPage * last.pageSize < last.total ? lastPage + 1 : undefined,
    ...(initial?.page === 1 && { initialData: { pages: [initial], pageParams: [1] } }),
    // Unobserved lists are dropped at once: returning to a filter restarts from the server page instead of
    // showing older cached pages that may disagree with it (e.g. with the server's empty state).
    gcTime: 0,
    enabled,
  });
  // Offset pages shift when records are created/removed between requests: keep the first occurrence of each id.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (result.data?.pages ?? []).flatMap(page => page.items).filter(item => !seen.has(item.id) && Boolean(seen.add(item.id)));
  }, [result.data]);
  const { data, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = result;
  return { data, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, items, total: data?.pages.at(-1)?.total ?? 0 };
}
