import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getAccess } from "@/server/access";
import { navigation } from "@/config/navigation";
import { can } from "@/lib/access/permissions";
import { ForbiddenState } from "@/components/feedback";

// Lands on the first section the user may open; without any, explains instead of looping.
export default async function BackofficePage() {
  await requireSession("/backoffice");
  const access = await getAccess();
  const first = navigation.find(item => !item.permission || can(access, item.permission));
  if (first) redirect(first.href);
  return <ForbiddenState />;
}
