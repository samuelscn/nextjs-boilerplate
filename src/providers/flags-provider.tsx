"use client";
import { createContext, useContext } from "react";
import type { FlagName, Flags } from "@/config/flags";

const FlagsContext = createContext<Partial<Flags>>({});
export function FlagsProvider({ flags, children }: { flags: Flags; children: React.ReactNode }) {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}
// Unknown/unprovided flags read as false: a missing provider never enables unreleased UI.
export function useFlag(name: FlagName) {
  return useContext(FlagsContext)[name] === true;
}
