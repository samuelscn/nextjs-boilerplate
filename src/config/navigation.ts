import type { Permission } from "@/lib/access/permissions";

// Items without permission are visible to every signed-in user. Hiding an item is UX only:
// each page still gates itself with <Authorize> and the API authorizes every call.
export const navigation: readonly { labelKey: string; href: string; icon: "users"; permission?: Permission }[] = [
  { labelKey: "backoffice.users.title", href: "/backoffice/users", icon: "users", permission: "member:read" },
];
