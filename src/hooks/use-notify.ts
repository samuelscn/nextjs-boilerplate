"use client";
import { useTranslations } from "next-intl";
import { toast } from "@ginga/ui";
import { localizedError } from "@/i18n/errors";

// Transient feedback for completed actions. Messages are translation keys; errors go through
// the same localizedError used by ErrorState, so codes and params are never bypassed.
// Keep form validation inline (fields + ErrorState); use toasts for row/menu actions.
export function useNotify() {
  const t = useTranslations();
  return {
    success: (key: string, values?: Record<string, string | number>) => toast.success(t(key, values)),
    error: (error: unknown) => toast.error(localizedError(error, t)),
  };
}
