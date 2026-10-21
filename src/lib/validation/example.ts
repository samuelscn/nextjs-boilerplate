import { z } from "zod";
import type { Problem } from "../http/api-error";

// Codes, not translated phrases: a fresh schema is created for client locale.
export function createExampleSchema(t: (key: string) => string) {
  return z.object({ label: z.string().trim().min(1, t("IS_NOT_EMPTY")).max(80, t("MAX_LENGTH")) });
}
export const exampleSchema = createExampleSchema(code => code);
export type ExampleValues = z.infer<typeof exampleSchema>;
export type ExampleResult = { ok: true } | { ok: false; error: Problem };
