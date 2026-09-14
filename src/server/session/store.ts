import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "@/lib/http/error";

export type Tokens = { accessToken: string; refreshToken?: string; accessExpiresAt: number; subject: string };
export type SessionRecord = Tokens & { expiresAt: number };
export type Transaction = { state: string; nonce: string; verifier: string; returnTo: string; expiresAt: number };
const key = (id: string) => createHash("sha256").update(id).digest("hex");
const identifier = () => randomBytes(32).toString("base64url");

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly transactions = new Map<string, Transaction>();
  readonly refreshes = new Map<string, Promise<SessionRecord | null>>();

  constructor(private readonly now: () => number = Date.now, private readonly capacity = 10_000) {}

  private prune() {
    for (const [id, record] of this.sessions) if (record.expiresAt <= this.now()) this.sessions.delete(id);
    for (const [id, record] of this.transactions) if (record.expiresAt <= this.now()) this.transactions.delete(id);
  }
  create(tokens: Tokens, ttl: number): string {
    this.prune();
    if (this.sessions.size >= this.capacity) throw new HttpError(503, "session_capacity");
    const id = identifier();
    this.sessions.set(key(id), { ...tokens, expiresAt: this.now() + ttl * 1000 });
    return id;
  }
  get(id: string | undefined): SessionRecord | null {
    if (!id || !/^[\w-]{43}$/u.test(id)) return null;
    const record = this.sessions.get(key(id));
    if (!record) return null;
    if (record.expiresAt <= this.now()) { this.destroy(id); return null; }
    return record;
  }
  replace(id: string, expected: SessionRecord, next: SessionRecord): boolean {
    if (this.get(id) !== expected) return false;
    this.sessions.set(key(id), next);
    return true;
  }
  destroy(id: string) { this.sessions.delete(key(id)); }
  begin(transaction: Omit<Transaction, "expiresAt">): string {
    this.prune();
    if (this.transactions.size >= Math.min(this.capacity, 1000)) throw new HttpError(429, "login_capacity");
    const id = identifier();
    this.transactions.set(key(id), { ...transaction, expiresAt: this.now() + 600_000 });
    return id;
  }
  consume(id: string | undefined): Transaction | null {
    if (!id || !/^[\w-]{43}$/u.test(id)) return null;
    const record = this.transactions.get(key(id));
    this.transactions.delete(key(id));
    return record && record.expiresAt > this.now() ? record : null;
  }
}

// Shared by route bundles and development reloads in ONE Node process only.
const runtime = globalThis as typeof globalThis & { gingaSessionStore?: SessionStore };
export const sessionStore = runtime.gingaSessionStore ??= new SessionStore();
