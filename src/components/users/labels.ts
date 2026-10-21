import type { Translate } from "@/i18n/errors";

// Roles are data from the Product API; unknown ids fall back to the raw id instead of a missing-message error.
export function roleLabel(id: string, t: Translate) {
  return t.has(id + ".name") ? t(id + ".name") : id;
}
export function roleDescription(id: string, t: Translate) {
  return t.has(id + ".description") ? t(id + ".description") : "";
}
