"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ginga/ui";

export type FilterOption = { value: string; label: string };

// Multi-value filter. Empty selection means "no filter" and shows `placeholder` (e.g. "All roles").
export function MultiSelectFilter({ label, placeholder, options, value, onChange, summary, className }: {
  label: string; placeholder: string; options: FilterOption[]; value: string[]; onChange: (value: string[]) => void;
  summary: (count: number) => string; className?: string;
}) {
  const items = Object.fromEntries(options.map(option => [option.value, option.label]));
  return <Select multiple items={items} value={value} onValueChange={next => onChange(next as string[])}>
    <SelectTrigger aria-label={label} className={className}>
      <SelectValue placeholder={placeholder}>{(selected: string[]) => selected.length === 0 ? placeholder : selected.length === 1 ? items[selected[0]!] ?? selected[0] : summary(selected.length)}</SelectValue>
    </SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
