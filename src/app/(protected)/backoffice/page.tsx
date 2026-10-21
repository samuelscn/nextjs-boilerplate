import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth";

// Users management is the only entry of the reference backoffice.
export default async function BackofficePage() {
  await requireSession("/backoffice");
  redirect("/backoffice/users");
}
