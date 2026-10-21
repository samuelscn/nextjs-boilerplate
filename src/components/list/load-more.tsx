"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button, Spinner } from "@ginga/ui";

// Footer of an infinite list: a sentinel loads the next page near the end of the scroll, and a visible
// button does the same for keyboard/screen-reader users and after an error (no automatic retry loop).
export function LoadMore({ loaded, total, hasNextPage, isFetchingNextPage, isError, onLoadMore }: {
  loaded: number; total: number; hasNextPage: boolean; isFetchingNextPage: boolean; isError: boolean; onLoadMore: () => void;
}) {
  const t = useTranslations("common.list");
  const sentinel = useRef<HTMLDivElement>(null);
  const auto = hasNextPage && !isFetchingNextPage && !isError;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !auto) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) onLoadMore(); }, { rootMargin: "320px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [auto, onLoadMore]);
  return <div className="grid justify-items-center gap-2 py-2 text-sm text-muted-foreground">
    <div ref={sentinel} aria-hidden className="h-px w-full" />
    <p aria-live="polite">{t("loaded", { count: loaded, total })}</p>
    {isError && <p role="alert" className="text-destructive">{t("loadError")}</p>}
    {hasNextPage ? <Button variant="outline" className="h-11 w-full" disabled={isFetchingNextPage} onClick={onLoadMore}>
      {isFetchingNextPage ? <><Spinner aria-hidden />{t("loadingMore")}</> : t(isError ? "retry" : "loadMore")}
    </Button> : loaded > 0 && <p>{t("end")}</p>}
  </div>;
}
