import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { dismissedSubscriptionCandidates } from "@/db/schema";
import { createTestAccount, createTestCategory, createTestUser, withRollback } from "@/lib/accounting/testing";
import { ValidationError } from "@/lib/accounting/errors";
import { dismissCandidate, parseDismissCandidateInput } from "./subscriptions";

describe("parseDismissCandidateInput", () => {
  it("parses a valid input", () => {
    const input = parseDismissCandidateInput({ accountId: "a1", categoryId: "c1", payeeKey: "netflix" });
    expect(input).toEqual({ accountId: "a1", categoryId: "c1", payeeKey: "netflix" });
  });

  it("rejects a missing body", () => {
    expect(() => parseDismissCandidateInput(null)).toThrow(ValidationError);
  });

  it("rejects a missing payeeKey", () => {
    expect(() => parseDismissCandidateInput({ accountId: "a1", categoryId: "c1" })).toThrow(ValidationError);
  });

  it("rejects a missing accountId", () => {
    expect(() => parseDismissCandidateInput({ categoryId: "c1", payeeKey: "netflix" })).toThrow(ValidationError);
  });
});

describe("dismissCandidate", () => {
  it("records a dismissal signature", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);
      const category = await createTestCategory(tx, user.id);

      await dismissCandidate(tx, user.id, { accountId: account.id, categoryId: category.id, payeeKey: "netflix" });

      const rows = await tx
        .select()
        .from(dismissedSubscriptionCandidates)
        .where(eq(dismissedSubscriptionCandidates.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].payeeKey).toBe("netflix");
    });
  });

  it("is a no-op on a repeat dismissal of the same signature", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);
      const category = await createTestCategory(tx, user.id);

      await dismissCandidate(tx, user.id, { accountId: account.id, categoryId: category.id, payeeKey: "netflix" });
      await dismissCandidate(tx, user.id, { accountId: account.id, categoryId: category.id, payeeKey: "netflix" });

      const rows = await tx
        .select()
        .from(dismissedSubscriptionCandidates)
        .where(eq(dismissedSubscriptionCandidates.userId, user.id));
      expect(rows).toHaveLength(1);
    });
  });
});
