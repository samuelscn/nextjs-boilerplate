"use client";
import type { FlagName } from "@/config/flags";
import { useFlag } from "@/providers/flags-provider";

// Renders children only while the flag is enabled. Server code gates with isEnabled(name).
export function Flag({ name, children, fallback = null }: { name: FlagName; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useFlag(name) ? children : fallback;
}
