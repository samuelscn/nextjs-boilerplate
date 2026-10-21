"use client";
import { useEffect, useMemo, useRef } from "react";

// Trailing debounce. `flush` runs the pending call now (e.g. on Enter); pending calls are dropped on unmount.
export function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delay: number) {
  const latest = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Args>(undefined);
  useEffect(() => { latest.current = callback; });
  const controls = useMemo(() => {
    const cancel = () => { clearTimeout(timer.current); pending.current = undefined; };
    return {
      call(...args: Args) { clearTimeout(timer.current); pending.current = args; timer.current = setTimeout(() => { pending.current = undefined; latest.current(...args); }, delay); },
      flush() { clearTimeout(timer.current); const args = pending.current; pending.current = undefined; if (args) latest.current(...args); },
      cancel,
    };
  }, [delay]);
  useEffect(() => controls.cancel, [controls]);
  return controls;
}
