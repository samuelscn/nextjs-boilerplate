import type { Permission } from "@/lib/api/schema";

// Client-safe helpers. Permissions only adapt the UI (hide/disable); the Product API
// authorizes every operation and the BFF re-checks before calling it.
export type { Permission };
export type Access = { userId: string; roleIds: string[]; permissions: Permission[] };
export const can = (access: Pick<Access, "permissions"> | null | undefined, permission: Permission) =>
  Boolean(access?.permissions.includes(permission));
export const canAny = (access: Pick<Access, "permissions"> | null | undefined, permissions: readonly Permission[]) =>
  permissions.some(permission => can(access, permission));
