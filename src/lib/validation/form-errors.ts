import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import type { ApiErrorDetail } from "../http/api-error";
import { localizedValidation, type Translate } from "@/i18n/errors";

// Explicit field allowlist prevents unknown/prototype paths from reaching RHF.
export function applyFieldErrors<T extends FieldValues>(
  details: readonly ApiErrorDetail[] | undefined,
  fields: readonly FieldPath<T>[],
  setError: UseFormSetError<T>,
  t: Translate,
): number {
  let mapped = 0;
  const seen = new Set<string>();
  for (const detail of details ?? []) {
    const field = fields.find(name => name === detail.field);
    if (!field || seen.has(field) || field.split(".").some(part => ["__proto__", "constructor", "prototype"].includes(part))) continue;
    setError(field, { type: "server", message: localizedValidation(detail.code, t) }, { shouldFocus: mapped === 0 });
    seen.add(field); mapped++;
  }
  return mapped;
}
