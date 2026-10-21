"use client";
import { createContext, useContext } from "react";
import { can, type Permission } from "@/lib/access/permissions";

// Only the resolved permission list reaches the browser: no tokens, roles internals or user data.
const AccessContext = createContext<readonly Permission[]>([]);
export function AccessProvider({ permissions, children }: { permissions: readonly Permission[]; children: React.ReactNode }) {
  return <AccessContext.Provider value={permissions}>{children}</AccessContext.Provider>;
}
export function useAccess() {
  return useContext(AccessContext);
}
export function useCan(permission: Permission) {
  return can({ permissions: [...useAccess()] }, permission);
}
