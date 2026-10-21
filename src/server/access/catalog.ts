import "server-only";
import { z } from "zod";
import openapi from "../../../contracts/openapi.json";
import type { Permission } from "@/lib/access/permissions";

// Runtime permission catalog from the published contract (npm run api:sync).
export const PERMISSIONS = openapi.components.schemas.Permission.enum as Permission[];
const known = new Set<string>(PERMISSIONS);

// Unknown permissions (newer API than this build) are dropped, never trusted.
export const myAccessSchema = z.object({
  userId: z.string().min(1).max(255),
  roleIds: z.array(z.string().max(64)).max(200),
  permissions: z.array(z.string().max(128)).max(1000)
    .transform(values => [...new Set(values.filter((value): value is Permission => known.has(value)))]),
});
