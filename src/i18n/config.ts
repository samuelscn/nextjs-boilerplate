import template from "../../template.config.json";

export const supportedLocales = ["pt-BR", "en"] as const;
export type Locale = typeof supportedLocales[number];
export const defaultLocale = template.i18n.defaultLocale as Locale;
export const localeNames: Record<Locale, string> = { "pt-BR": "Português (Brasil)", en: "English" };
export const localeCookie = "ginga_locale";
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.some(locale => locale === value);
}
export function resolveLocale(input: { explicit?: unknown; preference?: unknown; cookie?: unknown; acceptLanguage?: string | null; fallback?: Locale }): Locale {
  for (const value of [input.explicit, input.preference, input.cookie]) if (isLocale(value)) return value;
  const choices = (input.acceptLanguage ?? "").slice(0, 2048).split(",").slice(0, 20).map(part => {
    const [tag = "", ...params] = part.trim().split(";");
    const q = params.find(value => value.trim().startsWith("q="))?.trim().slice(2);
    return { tag: tag.toLowerCase(), q: q === undefined ? 1 : Number(q) };
  }).filter(item => Number.isFinite(item.q) && item.q > 0 && item.q <= 1).sort((a, b) => b.q - a.q);
  for (const { tag } of choices) {
    const match = supportedLocales.find(locale => locale.toLowerCase() === tag) ??
      supportedLocales.find(locale => locale.split("-")[0] === tag.split("-")[0]);
    if (match) return match;
  }
  return input.fallback ?? defaultLocale;
}
export function stripLocale(path: string) {
  const segment = path.split("/")[1];
  return isLocale(segment) ? { locale: segment, path: path.slice(segment.length + 1) || "/" } : { locale: undefined, path };
}
export function publicPrefix(env: { APP_KIND: string; I18N_URL_STRATEGY: string }) {
  return env.APP_KIND === "public" && env.I18N_URL_STRATEGY === "public-prefix";
}
export function localizedPath(path: string, locale: Locale) {
  return "/" + locale + (path === "/" ? "" : path);
}
export function isPublicPagePath(path: string) {
  return !/^\/(?:api|auth|app|backoffice|_next)(?:\/|$)/u.test(path) && !path.includes(".");
}
