import "server-only";
import { cache } from "react";
import { getEnv } from "@/config/env";
import type { FlagName, Flags } from "@/config/flags";

// Provider boundary: today flags come from validated env per environment. A remote service
// (Unleash, GrowthBook…) can implement this interface without touching call sites.
export interface FlagProvider { resolve(): Promise<Flags> }
export const envFlagProvider: FlagProvider = { resolve: async () => ({ ...getEnv().flags }) };

let provider: FlagProvider = envFlagProvider;
export function setFlagProvider(next: FlagProvider) { provider = next; }

// Resolved on the server once per request; the client receives only the resolved booleans.
export const getFlags = cache(() => provider.resolve());
export async function isEnabled(name: FlagName) {
  return (await getFlags())[name];
}
