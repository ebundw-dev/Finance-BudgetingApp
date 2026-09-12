import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { apiTokens } from "@/db/schema";
import type { Tx } from "@/lib/accounting/engine";

export function generateApiToken(): string {
  return randomBytes(32).toString("base64url");
}

// Unlike hashPassword (scrypt+salt, built for low-entropy human passwords
// where salting defeats rainbow tables), an API token is already 256 bits
// of random entropy -- a fast deterministic hash is both sufficient (no
// dictionary/rainbow-table risk against a random secret) and necessary: a
// salted hash can't be looked up by value, only reproduced given the same
// salt, which defeats an indexed lookup by token. The raw token itself is
// returned to the caller once, at issue time, and never stored.
export function hashApiToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface IssuedApiToken {
  id: string;
  token: string;
  name: string;
  createdAt: Date;
}

export async function issueApiToken(tx: Tx, userId: string, name: string): Promise<IssuedApiToken> {
  const token = generateApiToken();
  const [row] = await tx
    .insert(apiTokens)
    .values({ userId, tokenHash: hashApiToken(token), name })
    .returning();
  return { id: row.id, token, name: row.name, createdAt: row.createdAt };
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export async function listApiTokensForUser(tx: Tx, userId: string): Promise<ApiTokenSummary[]> {
  return tx
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(apiTokens.createdAt);
}

// Scoped to the owning user -- revoking someone else's token by guessing
// its id silently no-ops (returns false) rather than revealing whether
// that id exists.
export async function revokeApiToken(tx: Tx, userId: string, tokenId: string): Promise<boolean> {
  const result = await tx
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });
  return result.length > 0;
}

export interface ApiAuthSession {
  userId: string;
  tokenId: string;
}

// Verifies a request's Authorization: Bearer <token> header against
// api_tokens and bumps lastUsedAt on success. Returns null (never throws)
// for every failure mode -- missing header, malformed header, unknown
// token, revoked token -- so callers can respond 401 uniformly without
// needing to distinguish why.
export async function verifyApiToken(tx: Tx, request: Request): Promise<ApiAuthSession | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;

  const tokenHash = hashApiToken(raw);
  const [row] = await tx.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
  if (!row || row.revokedAt) return null;

  await tx.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));

  return { userId: row.userId, tokenId: row.id };
}
