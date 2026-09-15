import ptCommon from "../../messages/pt-BR/common.json";
import enCommon from "../../messages/en/common.json";
import ptErrors from "../../messages/pt-BR/errors.json";
import enErrors from "../../messages/en/errors.json";
import ptAuth from "../../messages/pt-BR/auth.json";
import enAuth from "../../messages/en/auth.json";
import ptValidation from "../../messages/pt-BR/validation.json";
import enValidation from "../../messages/en/validation.json";
import ptPublic from "../../messages/pt-BR/public.json";
import enPublic from "../../messages/en/public.json";
import ptBackoffice from "../../messages/pt-BR/backoffice.json";
import enBackoffice from "../../messages/en/backoffice.json";
import ptForms from "../../messages/pt-BR/forms.json";
import enForms from "../../messages/en/forms.json";
import type { Locale } from "./config";

// Explicit imports: an untrusted locale can never become a filesystem path.
export const catalogs = {
  "pt-BR": { common: ptCommon, errors: ptErrors, auth: ptAuth, validation: ptValidation, public: ptPublic, backoffice: ptBackoffice, forms: ptForms },
  en: { common: enCommon, errors: enErrors, auth: enAuth, validation: enValidation, public: enPublic, backoffice: enBackoffice, forms: enForms },
} satisfies Record<Locale, unknown>;
