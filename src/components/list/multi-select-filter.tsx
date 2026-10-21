"use client";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ginga/ui";

export type FilterOption = { value: string; label: string };

// Multi-value filter. Empty selection means "no filter" and shows `placeholder` (e.g. "All roles").
// `value` comes from the URL and only changes after the server round-trip, so the selection is kept
// locally: otherwise a second pick before navigation settles would start from the stale value.
// URL values this component emitted itself are ignored; any other change (clear, back) resets it.
export function MultiSelectFilter({ label, placeholder, options, value, onChange, summary, className }: {
  label: string; placeholder: string; options: FilterOption[]; value: string[]; onChange: (value: string[]) => void;
  summary: (count: number) => string; className?: string;
}) {
  const items = Object.fromEntries(options.map(option => [option.value, option.label]));
  const key = value.join();
  const [state, setState] = useState({ key, selected: value, emitted: [] as string[] });
  if (state.key !== key) setState(state.emitted.at(-1) === key ? { ...state, key, emitted: [] }
    : state.emitted.includes(key) ? { ...state, key } : { key, selected: value, emitted: [] });
  const select = (next: string[]) => { setState({ ...state, selected: next, emitted: [...state.emitted, next.join()] }); onChange(next); };
  return <Select multiple items={items} value={state.selected} onValueChange={next => select(next as string[])}>
    <SelectTrigger aria-label={label} className={className}>
      <SelectValue placeholder={placeholder}>{(selected: string[]) => selected.length === 0 ? placeholder : selected.length === 1 ? items[selected[0]!] ?? selected[0] : summary(selected.length)}</SelectValue>
    </SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
