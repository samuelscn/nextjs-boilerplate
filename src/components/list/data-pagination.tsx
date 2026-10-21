"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ginga/ui";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageRange, patchSearchParams } from "@/lib/list/params";
import { useListParams } from "@/hooks/use-list-params";

// Page links are real URLs (?page=n) so they are crawlable, shareable and keep every other filter.
export function DataPagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const t = useTranslations("common.list");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { update } = useListParams({ pageSize: DEFAULT_PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) => {
    const next = patchSearchParams(new URLSearchParams(searchParams), { page: target === 1 ? undefined : target });
    return next.size ? pathname + "?" + next : pathname;
  };
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(page * pageSize, total);
  const sizes = Object.fromEntries(PAGE_SIZES.map(size => [String(size), String(size)]));
  return <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <p className="text-sm text-muted-foreground" aria-live="polite">{t("range", { from, to, total })}</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden>{t("perPage")}</span>
        <Select items={sizes} value={String(pageSize)} onValueChange={value => update({ pageSize: value === String(DEFAULT_PAGE_SIZE) ? undefined : value })}>
          <SelectTrigger size="sm" aria-label={t("perPage")}><SelectValue /></SelectTrigger>
          <SelectContent>{PAGE_SIZES.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {pageCount > 1 && <Pagination aria-label={t("pagination")} className="mx-0 w-auto"><PaginationContent>
        <PaginationItem><PaginationPrevious label={t("previous")} disabled={page <= 1} {...(page > 1 && { render: <Link href={href(page - 1)} scroll={false} /> })} /></PaginationItem>
        {pageRange(page, pageCount).map((item, index) => <PaginationItem key={item === "ellipsis" ? "e" + index : item}>
          {item === "ellipsis" ? <PaginationEllipsis label={t("more")} />
            : <PaginationLink isActive={item === page} aria-label={t("page", { page: item })} render={<Link href={href(item)} scroll={false} />}>{item}</PaginationLink>}
        </PaginationItem>)}
        <PaginationItem><PaginationNext label={t("next")} disabled={page >= pageCount} {...(page < pageCount && { render: <Link href={href(page + 1)} scroll={false} /> })} /></PaginationItem>
      </PaginationContent></Pagination>}
    </div>
  </div>;
}
