import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { accounts } from "@/db/schema";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "@/lib/accounting/testing";
import { InsufficientUnallocatedCashError, ValidationError } from "@/lib/accounting/errors";
import { deleteTransaction, recordAllocation, recordReconciliation } from "./engine";

describe("recordReconciliation", () => {
  it("records a match (equal balance) without creating a transaction row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });

      const result = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "100.00",
      });

      expect(result.matched).toBe(true);
      const [updated] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(updated.currentBalance).toBe("100.00");
      expect(updated.lastReconciledAt).not.toBeNull();
      expect(updated.lastReconciledBalance).toBe("100.00");
    });
  });

  it("posts a surplus adjustment and raises Unallocated Cash by the delta", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const before = await getUnallocatedCash(tx, user.id);

      const result = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "125.00",
        notes: "Found an ATM deposit the app never saw.",
      });

      expect(result.matched).toBe(false);
      expect(result.delta).toBe("25.00");
      const [updated] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(updated.currentBalance).toBe("125.00");
      const after = await getUnallocatedCash(tx, user.id);
      expect(Number(after) - Number(before)).toBeCloseTo(25, 2);
    });
  });

  it("posts a shortfall adjustment and lowers Unallocated Cash by the delta", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const before = await getUnallocatedCash(tx, user.id);

      const result = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "90.00",
      });

      expect(result.delta).toBe("-10.00");
      const [updated] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(updated.currentBalance).toBe("90.00");
      const after = await getUnallocatedCash(tx, user.id);
      expect(Number(after) - Number(before)).toBeCloseTo(-10, 2);
    });
  });

  it("rejects a shortfall that would take Unallocated Cash negative", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const category = await createTestCategory(tx, user.id, { allocatedBalance: "0" });
      // Leaves only 10.00 Unallocated Cash.
      await recordAllocation(tx, user.id, { categoryId: category.id, amount: "90.00", date: "2026-01-01" });

      // A shortfall of 100.00 (down to a zero balance) needs more than the
      // 10.00 that's actually unallocated.
      await expect(
        recordReconciliation(tx, user.id, { accountId: account.id, statementBalance: "0.00" })
      ).rejects.toThrow(InsufficientUnallocatedCashError);

      const [unchanged] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(unchanged.currentBalance).toBe("100.00");
    });
  });

  it("rejects reconciling a non-cash account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "50.00",
      });

      await expect(
        recordReconciliation(tx, user.id, { accountId: account.id, statementBalance: "60.00" })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects a non-numeric statement balance", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "10.00" });

      await expect(
        recordReconciliation(tx, user.id, { accountId: account.id, statementBalance: "not a number" })
      ).rejects.toThrow(ValidationError);
    });
  });
});

describe("deleteTransaction (reconciliation)", () => {
  it("reverses a surplus reconciliation, restoring the prior balance and Unallocated Cash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const before = await getUnallocatedCash(tx, user.id);

      const { transaction } = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "150.00",
      });

      await deleteTransaction(tx, user.id, transaction!.id);

      const [reverted] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(reverted.currentBalance).toBe("100.00");
      const after = await getUnallocatedCash(tx, user.id);
      expect(after).toBe(before);
    });
  });

  it("reverses a shortfall reconciliation, restoring the prior balance", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });

      const { transaction } = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "80.00",
      });

      await deleteTransaction(tx, user.id, transaction!.id);

      const [reverted] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(reverted.currentBalance).toBe("100.00");
    });
  });

  it("rejects reversing a surplus reconciliation if the surplus has since been allocated away", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const category = await createTestCategory(tx, user.id, { allocatedBalance: "0" });

      const { transaction } = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "150.00",
      });

      // Spend more than the newly-surfaced surplus (150.00 total
      // Unallocated Cash available at this point) before trying to
      // reverse the reconciliation that created it.
      await recordAllocation(tx, user.id, { categoryId: category.id, amount: "120.00", date: "2026-01-01" });

      await expect(deleteTransaction(tx, user.id, transaction!.id)).rejects.toThrow(
        InsufficientUnallocatedCashError
      );
    });
  });
});
