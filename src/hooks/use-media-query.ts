"use client";
import { useCallback, useSyncExternalStore } from "react";

// For behavior only (e.g. enabling a fetch), never for choosing markup: the server snapshot is `false`,
// so layout switches stay in CSS (`md:hidden`) and hydration never mismatches.
export function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
