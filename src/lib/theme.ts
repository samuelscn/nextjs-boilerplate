// Color theme preference: explicit light/dark or the OS setting. Stored in a first-party
// cookie and applied on the server (class "dark" on <html>, the DS dark tokens), so pages
// render in the right theme without a flash. "system" is resolved by a nonce'd inline script.
export const themeCookie = "ginga_theme";
export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];
export const parseTheme = (value: string | undefined): Theme => (themes as readonly string[]).includes(value ?? "") ? value as Theme : "system";
