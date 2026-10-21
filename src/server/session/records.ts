import "server-only";
import { z } from "zod";

// Shapes sealed into the session and login cookies (see seal.ts). Versioned so a format change fails closed.
export const tokensSchema = z.object({
  subject: z.string().min(1).max(255),
  accessToken: z.string().min(1).max(3000),
  refreshToken: z.string().min(1).max(512).optional(),
  accessExpiresAt: z.number().int(),
});
export const sessionSchema = tokensSchema.extend({ v: z.literal(1), expiresAt: z.number().int() });
export const transactionSchema = z.object({
  v: z.literal(1), state: z.string().min(1).max(256), nonce: z.string().min(1).max(256),
  verifier: z.string().min(43).max(128), returnTo: z.string().min(1).max(2048),
});
export type Tokens = z.infer<typeof tokensSchema>;
// `expiresAt` is the absolute end of the session: refreshing never extends it.
export type SessionRecord = z.infer<typeof sessionSchema>;
export type Transaction = Omit<z.infer<typeof transactionSchema>, "v">;
