import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories } from "@/db/schema";
import { recordTransfer } from "./engine";
import { ValidationError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordTransfer", () => {
  it("moves cash between two cash accounts without touching categories", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, {
        name: "Checking",
        currentBalance: "300.00",
      });
      const savings = await createTestAccount(tx, user.id, {
        name: "Savings",
        currentBalance: "50.00",
      });
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "120.00",
      });

      const txn = await recordTransfer(tx, user.id, {
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: "100.00",
        date: "2026-01-01",
      });

      expect(txn.type).toBe("transfer");
      expect(txn.categoryId).toBeNull();

      const [updatedChecking] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, checking.id));
      const [updatedSavings] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, savings.id));
      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));

      expect(updatedChecking.currentBalance).toBe("200.00");
      expect(updatedSavings.currentBalance).toBe("150.00");
      // Total cash is unchanged, so Unallocated Cash and every category are too.
      expect(updatedCategory.allocatedBalance).toBe("120.00");
    });
  });

  it("rejects transferring an account to itself", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "100.00",
      });

      await expect(
        recordTransfer(tx, user.id, {
          fromAccountId: account.id,
          toAccountId: account.id,
          amount: "10.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects a transfer touching a non-cash account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, {
        currentBalance: "300.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });

      await expect(
        recordTransfer(tx, user.id, {
          fromAccountId: checking.id,
          toAccountId: cardAccount.id,
          amount: "10.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
