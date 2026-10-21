import { z } from "zod";

// List screens keep their whole state (search, filters, page) in the URL so views are shareable,
// survive reloads and work with back/forward. Multi-value filters repeat the key: ?role=a&role=b.
export type RawSearchParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];
export const toArray = <T>(value: T | readonly T[] | null | undefined): T[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? [...value] : [value as T];

// Invalid, duplicated or excess values are dropped instead of failing the whole query.
export function multiValue<T extends z.ZodType>(item: T, max = 10) {
  return z.preprocess(toArray, z.array(z.unknown()).transform(values => [...new Set(values.flatMap(value => {
    const parsed = item.safeParse(value);
    return parsed.success ? [parsed.data as z.output<T>] : [];
  }))].slice(0, max))) as unknown as z.ZodType<z.output<T>[], unknown>;
}

export const searchParam = z.string().trim().max(80).catch("");
export const pageParam = z.coerce.number().int().min(1).max(100_000).catch(1);
export const pageSizeParam = z.coerce.number().refine(value => (PAGE_SIZES as readonly number[]).includes(value)).catch(DEFAULT_PAGE_SIZE);
export const listParams = { q: searchParam, page: pageParam, pageSize: pageSizeParam };

export type ParamValue = string | number | readonly (string | number)[] | null | undefined;

// Applies a patch to existing params. Empty values remove the key; page resets unless set explicitly.
export function patchSearchParams(current: URLSearchParams, patch: Record<string, ParamValue>, defaults: Record<string, ParamValue> = {}) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    next.delete(key);
    const values = toArray(value).map(String).filter(Boolean);
    if (values.join() === toArray(defaults[key]).map(String).join()) continue;
    for (const item of values) next.append(key, item);
  }
  if (!("page" in patch)) next.delete("page");
  return next;
}

// Window of page numbers with ellipses and a stable width, e.g. 1 2 3 4 5 … 20 · 1 … 9 10 11 … 20 · 1 … 16 17 18 19 20.
export function pageRange(page: number, pageCount: number, siblings = 1): (number | "ellipsis")[] {
  const edge = siblings * 2 + 3;
  if (pageCount <= edge + 2) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const span = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
  if (page <= edge - 1) return [...span(1, edge), "ellipsis", pageCount];
  if (page >= pageCount - edge + 2) return [1, "ellipsis", ...span(pageCount - edge + 1, pageCount)];
  return [1, "ellipsis", ...span(page - siblings, page + siblings), "ellipsis", pageCount];
}
