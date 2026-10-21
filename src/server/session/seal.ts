import "server-only";
import { createHash } from "node:crypto";
import { EncryptJWT, base64url, jwtDecrypt } from "jose";
import type { z } from "zod";

// Stateless session storage: payloads are sealed as compact JWE (dir + A256GCM) with server-only keys,
// so cookies are unreadable and tamper-proof in the browser and no instance needs shared memory.
// SESSION_SECRETS: comma-separated base64url 32-byte keys. The first seals, every key opens, so a new key
// is added in front and the old one removed after SESSION_TTL_SECONDS (rotation without a global logout).
export type SealKey = { id: string; key: Uint8Array };

export function parseSealKeys(secrets: string): SealKey[] {
  const keys = secrets.split(",").map(secret => secret.trim()).filter(Boolean).map(secret => {
    const key = base64url.decode(secret);
    if (key.length !== 32) throw new Error("Invalid session secret");
    return { id: createHash("sha256").update(key).digest("hex").slice(0, 16), key };
  });
  if (!keys.length) throw new Error("Missing session secret");
  return keys;
}

export async function seal(payload: Record<string, unknown>, keys: SealKey[], expiresAt: number, now: number): Promise<string> {
  const [current] = keys;
  if (!current) throw new Error("No session key");
  return new EncryptJWT(payload).setProtectedHeader({ alg: "dir", enc: "A256GCM", kid: current.id })
    .setIssuedAt(Math.floor(now / 1000)).setExpirationTime(Math.floor(expiresAt / 1000)).encrypt(current.key);
}

// Any failure (tampering, unknown key, expiry, unexpected shape) means "no payload", never an error.
export async function unseal<T>(token: string | undefined, keys: SealKey[], schema: z.ZodType<T>, now: number, options: { ignoreExpiry?: boolean } = {}): Promise<T | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtDecrypt(token, async header => {
      const match = keys.find(key => key.id === header.kid);
      if (!match) throw new Error("Unknown key");
      return match.key;
    }, { keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"], currentDate: new Date(options.ignoreExpiry ? 0 : now) });
    const parsed = schema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
