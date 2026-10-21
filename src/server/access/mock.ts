import "server-only";
import type { Access } from "@/lib/access/permissions";
import { PERMISSIONS } from "./catalog";

// API_MODE=mock: the signed-in user gets API_MOCK_PERMISSIONS ("*" = all) so restricted
// screens can be exercised without the Product API. Never composed in production (config refuses it).
export function mockAccess(userId: string, configured: string): Access {
  const requested = configured.split(",").map(value => value.trim()).filter(Boolean);
  const permissions = requested.includes("*") ? [...PERMISSIONS] : PERMISSIONS.filter(permission => requested.includes(permission));
  return { userId, roleIds: [], permissions };
}
