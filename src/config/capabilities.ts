import template from "../../template.config.json";

export type AppKind = keyof typeof template.profiles;
export const capabilities = (kind: AppKind) => template.profiles[kind];
