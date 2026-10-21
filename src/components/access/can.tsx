"use client";
import type { Permission } from "@/lib/access/permissions";
import { useCan } from "@/providers/access-provider";

// Hides UI the user cannot use. Prefer hiding creation/destructive actions; for contextual
// actions consider rendering them disabled with an explanation via `fallback`.
export function Can({ permission, children, fallback = null }: { permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useCan(permission) ? children : fallback;
}
