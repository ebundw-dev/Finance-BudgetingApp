import { describe, expect, it } from "vitest";
import { createTestUser, withRollback } from "@/lib/accounting/testing";
import { hashApiToken, issueApiToken, listApiTokensForUser, revokeApiToken, verifyApiToken } from "./apiTokens";

function requestWithBearer(token: string): Request {
  return new Request("http://localhost/api/test", { headers: { authorization: `Bearer ${token}` } });
}

describe("hashApiToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashApiToken("abc")).toBe(hashApiToken("abc"));
  });

  it("differs for different input", () => {
    expect(hashApiToken("abc")).not.toBe(hashApiToken("xyz"));
  });
});

describe("issueApiToken", () => {
  it("returns a raw token and stores only its hash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const issued = await issueApiToken(tx, user.id, "iPhone");

      expect(issued.token).toBeTruthy();
      expect(issued.name).toBe("iPhone");

      const rows = await listApiTokensForUser(tx, user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ name: "iPhone", lastUsedAt: null, revokedAt: null });
      expect(rows[0]).not.toHaveProperty("token");
      expect(rows[0]).not.toHaveProperty("tokenHash");
    });
  });
});

describe("verifyApiToken", () => {
  it("resolves the owning user for a valid token", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const issued = await issueApiToken(tx, user.id, "iPhone");

      const session = await verifyApiToken(tx, requestWithBearer(issued.token));
      expect(session).toEqual({ userId: user.id, tokenId: issued.id });
    });
  });

  it("returns null for an unknown token", async () => {
    await withRollback(async (tx) => {
      const session = await verifyApiToken(tx, requestWithBearer("not-a-real-token"));
      expect(session).toBeNull();
    });
  });

  it("returns null for a missing or non-Bearer Authorization header", async () => {
    await withRollback(async (tx) => {
      expect(await verifyApiToken(tx, new Request("http://localhost/api/test"))).toBeNull();
      expect(
        await verifyApiToken(
          tx,
          new Request("http://localhost/api/test", { headers: { authorization: "Basic abc" } })
        )
      ).toBeNull();
    });
  });

  it("returns null for a revoked token", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const issued = await issueApiToken(tx, user.id, "iPhone");
      await revokeApiToken(tx, user.id, issued.id);

      const session = await verifyApiToken(tx, requestWithBearer(issued.token));
      expect(session).toBeNull();
    });
  });

  it("bumps lastUsedAt on a successful verification", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const issued = await issueApiToken(tx, user.id, "iPhone");

      await verifyApiToken(tx, requestWithBearer(issued.token));

      const [row] = await listApiTokensForUser(tx, user.id);
      expect(row.lastUsedAt).not.toBeNull();
    });
  });
});

describe("revokeApiToken", () => {
  it("only revokes a token owned by the given user", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const stranger = await createTestUser(tx);
      const issued = await issueApiToken(tx, owner.id, "iPhone");

      expect(await revokeApiToken(tx, stranger.id, issued.id)).toBe(false);
      expect(await revokeApiToken(tx, owner.id, issued.id)).toBe(true);

      const [row] = await listApiTokensForUser(tx, owner.id);
      expect(row.revokedAt).not.toBeNull();
    });
  });

  it("returns false for a token id that doesn't exist", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      expect(await revokeApiToken(tx, user.id, "00000000-0000-0000-0000-000000000000")).toBe(false);
    });
  });
});
