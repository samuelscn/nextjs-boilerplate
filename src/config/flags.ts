// Feature flag registry. Every flag documents its purpose, owner and removal date, and its
// default is the value that is safe to ship. Values come from FEATURE_FLAGS per environment
// ("rolesEditor=false,otherFlag=true"); unknown names fail configuration (typos never pass).
type FlagDefinition = { default: boolean; description: string; owner: string; removeBy: string };

export const flagDefinitions = {
  rolesEditor: {
    default: true,
    description: "Create, edit and delete custom roles in the backoffice.",
    owner: "platform",
    removeBy: "2027-06-30",
  },
} as const satisfies Record<string, FlagDefinition>;

export type FlagName = keyof typeof flagDefinitions;
export type Flags = Record<FlagName, boolean>;
export const flagNames = Object.keys(flagDefinitions) as FlagName[];

export function parseFlags(value: string | undefined): Flags {
  const flags = Object.fromEntries(flagNames.map(name => [name, flagDefinitions[name].default])) as Flags;
  for (const entry of (value ?? "").split(",").map(part => part.trim()).filter(Boolean)) {
    const [name, raw] = entry.split("=").map(part => part.trim());
    if (!name || !flagNames.includes(name as FlagName) || (raw !== "true" && raw !== "false")) throw new Error("Invalid feature flag");
    flags[name as FlagName] = raw === "true";
  }
  return flags;
}
