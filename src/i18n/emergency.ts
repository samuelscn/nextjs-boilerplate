import ptCommon from "../../messages/pt-BR/common.json";
import enCommon from "../../messages/en/common.json";
import ptErrors from "../../messages/pt-BR/errors.json";
import enErrors from "../../messages/en/errors.json";
import type { Locale } from "./config";

// Small independent catalogs for a root-layout failure, not a second translator.
export const emergencyCatalogs = {
  "pt-BR": { common: ptCommon, errors: ptErrors },
  en: { common: enCommon, errors: enErrors },
} satisfies Record<Locale, unknown>;
