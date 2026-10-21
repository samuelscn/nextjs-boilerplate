import { z } from "zod";
import { listParams, multiValue } from "@/lib/list/params";

// Mirrors the Product API contract (contracts/openapi.json: MemberResponseDto, RoleResponseDto…).
// Used to validate live responses and BFF outputs; never trust the wire without it.
export const memberStatuses = ["invited", "active", "suspended"] as const;
export const memberStatusSchema = z.enum(memberStatuses);
export const memberSchema = z.object({
  id: z.uuid(), identityUserId: z.string().max(255).nullable(),
  displayName: z.string().max(120).nullable(), email: z.email().max(254).nullable(),
  status: memberStatusSchema, lastSeenAt: z.iso.datetime({ offset: true }).nullable(),
  roleIds: z.array(z.uuid()).max(100),
});
export const memberPageSchema = z.object({
  items: z.array(memberSchema).max(100), total: z.number().int().min(0),
  page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100),
});
export const roleSchema = z.object({
  id: z.uuid(), name: z.string().max(120), slug: z.string().max(80), description: z.string().max(500).nullable(),
  isSystem: z.boolean(), permissions: z.array(z.string().max(128)).max(1000),
});
export const rolesSchema = z.array(roleSchema).max(500);
export const permissionCatalogSchema = z.object({
  groups: z.array(z.object({ resource: z.string().max(64), permissions: z.array(z.string().max(128)).max(100) })).max(100),
});
export const okSchema = z.object({ ok: z.literal(true) });

// URL state: ?q=ana&role=<uuid>&role=<uuid>&status=active&page=2&pageSize=20
export const usersQuerySchema = z.object({
  ...listParams, role: multiValue(z.uuid()), status: multiValue(memberStatusSchema),
});
export type MemberStatus = z.infer<typeof memberStatusSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberPage = z.infer<typeof memberPageSchema>;
export type Role = z.infer<typeof roleSchema>;
export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>;
export type UsersQuery = z.output<typeof usersQuerySchema>;

// Codes, not translated phrases: a fresh schema is created for the client locale.
export function createInviteSchema(t: (key: string) => string) {
  return z.object({ email: z.email(t("IS_EMAIL")).max(254, t("MAX_LENGTH")), roleId: z.uuid(t("IS_NOT_EMPTY")) });
}
export const inviteSchema = createInviteSchema(code => code);
export type InviteValues = z.infer<typeof inviteSchema>;
export const changeStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active", "suspended"]) });
export const roleAssignmentSchema = z.object({ memberId: z.uuid(), roleId: z.uuid(), assigned: z.boolean() });
export function createRoleSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("IS_NOT_EMPTY")).max(120, t("MAX_LENGTH")),
    slug: z.string().trim().min(1, t("IS_NOT_EMPTY")).max(80, t("MAX_LENGTH")).regex(/^[a-z][a-z0-9-]*$/u, t("INVALID_SLUG")),
    description: z.string().trim().max(500, t("MAX_LENGTH")),
    permissions: z.array(z.string().max(128)).min(1, t("PERMISSIONS_REQUIRED")).max(1000),
  });
}
export const roleInputSchema = createRoleSchema(code => code);
export type RoleValues = z.infer<typeof roleInputSchema>;
export const roleUpdateSchema = roleInputSchema.extend({ id: z.uuid() });
export const roleIdSchema = z.object({ id: z.uuid() });
