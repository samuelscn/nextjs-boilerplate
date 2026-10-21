"use client";
import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@ginga/ui";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

// Debounced search box. `value` is the committed (URL) value; typing only calls onSearch after `delay` ms or on Enter.
export function SearchInput({ value, onSearch, label, delay = 300, maxLength = 80 }: { value: string; onSearch: (value: string) => void; label: string; delay?: number; maxLength?: number }) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // External changes (clear filters, back/forward) replace the draft, but never the user's in-flight typing.
  if (value !== synced) { setSynced(value); if (value !== draft.trim()) setDraft(value); }
  const search = useDebouncedCallback((next: string) => onSearch(next.trim()), delay);
  return <div className="relative min-w-0 flex-1 md:max-w-sm">
    <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" value={draft} maxLength={maxLength} aria-label={label} placeholder={label} className="pl-9"
      onChange={event => { setDraft(event.target.value); search.call(event.target.value); }}
      onKeyDown={event => { if (event.key === "Enter") search.flush(); }} />
  </div>;
}
