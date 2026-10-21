"use client";
import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hrefWithParams, patchSearchParams, type ParamValue } from "@/lib/list/params";

// Writes list state to the URL. The server component re-reads searchParams, so the URL is the single source of truth.
export function useListParams(defaults: Record<string, ParamValue> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = useCallback((patch: Record<string, ParamValue>) => {
    const next = patchSearchParams(new URLSearchParams(searchParams), patch, defaults);
    startTransition(() => router.replace(hrefWithParams(pathname, next), { scroll: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per screen
  }, [router, pathname, searchParams]);
  const clear = useCallback((keys: string[]) => update(Object.fromEntries(keys.map(key => [key, undefined]))), [update]);
  return { update, clear, pending };
}
