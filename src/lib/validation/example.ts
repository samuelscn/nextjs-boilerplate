import { z } from "zod";

// Neutral documentation example: no persistence or product endpoint is mounted.
export const exampleSchema = z.object({
  label: z.string().trim().min(1, "Informe um texto.").max(80, "Use até 80 caracteres."),
});
export type ExampleValues = z.infer<typeof exampleSchema>;
export type ExampleResult = { ok: true } | { ok: false; fieldErrors?: { label?: string }; message: string };
