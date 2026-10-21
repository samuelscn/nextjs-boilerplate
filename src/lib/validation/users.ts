import { z } from "zod";
import { listParams, multiValue } from "@/lib/list/params";

export const userStatuses = ["active", "invited", "suspended"] as const;
export const userStatusSchema = z.enum(userStatuses);
export const roleSchema = z.object({ id: z.string().min(1).max(64), permissions: z.number().int().min(0), users: z.number().int().min(0) });
export const userSchema = z.object({
  id: z.uuid(), name: z.string().max(120), email: z.email().max(254), roleId: z.string().min(1).max(64),
  status: userStatusSchema, lastAccessAt: z.iso.datetime({ offset: true }).nullable(),
});
export const usersPageSchema = z.object({
  users: z.array(userSchema), roles: z.array(roleSchema), total: z.number().int().min(0),
  page: z.number().int().min(1), pageSize: z.number().int().min(1), pageCount: z.number().int().min(1),
});
// URL state: ?q=ana&role=admin&role=manager&status=active&page=2&pageSize=20
export const usersQuerySchema = z.object({
  ...listParams, role: multiValue(z.string().min(1).max(64)), status: multiValue(userStatusSchema),
});
export type UsersPage = z.infer<typeof usersPageSchema>;
export type Role = z.infer<typeof roleSchema>;
export type User = z.infer<typeof userSchema>;
export type UsersQuery = z.output<typeof usersQuerySchema>;

// Codes, not translated phrases: a fresh schema is created for the client locale.
export function createInviteSchema(t: (key: string) => string) {
  return z.object({ email: z.email(t("IS_EMAIL")).max(254, t("MAX_LENGTH")), roleId: z.string().min(1, t("IS_NOT_EMPTY")).max(64, t("MAX_LENGTH")) });
}
export const inviteSchema = createInviteSchema(code => code);
export type InviteValues = z.infer<typeof inviteSchema>;
export const changeRoleSchema = z.object({ id: z.uuid(), roleId: z.string().min(1).max(64) });
export const changeStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active", "suspended"]) });
