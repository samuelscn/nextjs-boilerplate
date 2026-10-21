import type { Translate } from "@/i18n/errors";
import type { Role } from "@/lib/validation/users";

// Role names are data from the Product API. System roles (owner/admin/member) are translated
// by slug; custom roles show the name their creator typed.
export function roleLabel(role: Pick<Role, "slug" | "name" | "isSystem">, t: Translate) {
  return role.isSystem && t.has(role.slug + ".name") ? t(role.slug + ".name") : role.name;
}
export function roleDescription(role: Pick<Role, "slug" | "description" | "isSystem">, t: Translate) {
  return role.isSystem && t.has(role.slug + ".description") ? t(role.slug + ".description") : role.description ?? "";
}
// `member:invite` → permissions.member.invite; unknown permissions fall back to the raw value.
export function permissionLabel(permission: string, t: Translate) {
  const key = permission.replace(":", ".");
  return t.has(key) ? t(key) : permission;
}
export function resourceLabel(resource: string, t: Translate) {
  return t.has(resource + ".label") ? t(resource + ".label") : resource;
}
