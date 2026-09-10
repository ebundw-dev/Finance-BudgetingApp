import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories } from "@/db/schema";
import { recordDebtPayment, recordExpense } from "./engine";
import {
  InsufficientCategoryBalanceError,
  NotFoundError,
  ValidationError,
} from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordDebtPayment", () => {
  it("decreases the cash account, the debt account, and the debt's reserve category -- never a spending category", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, {
        currentBalance: "400.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "150.00",
      });
      const debt = await createTestDebt(tx, user.id, cardAccount.id, {
        startingBalance: "150.00",
        reserveBalance: "150.00",
      });

      const txn = await recordDebtPayment(tx, user.id, {
        fromAccountId: cashAccount.id,
        debtAccountId: cardAccount.id,
        amount: "150.00",
        date: "2026-01-01",
      });

      expect(txn.type).toBe("debt_payment");
      expect(txn.categoryId).toBe(debt.categoryId);

      const [updatedCash] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cashAccount.id));
      const [updatedCard] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cardAccount.id));
      const [reserveCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, debt.categoryId));

      expect(updatedCash.currentBalance).toBe("250.00");
      expect(updatedCard.currentBalance).toBe("0.00");
      expect(reserveCategory.allocatedBalance).toBe("0.00");
    });
  });

  it("a card purchase followed by paying the bill is not double-counted as spending", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, {
        currentBalance: "500.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      const debt = await createTestDebt(tx, user.id, cardAccount.id);
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "80.00",
      });

      // Purchase: category absorbs the spend, cash untouched, card debt rises.
      await recordExpense(tx, user.id, {
        accountId: cardAccount.id,
        categoryId: category.id,
        amount: "80.00",
        date: "2026-01-01",
      });

      // Paying the bill: cash and card debt move, category is untouched --
      // the spend was already recorded at purchase time.
      await recordDebtPayment(tx, user.id, {
        fromAccountId: cashAccount.id,
        debtAccountId: cardAccount.id,
        amount: "80.00",
        date: "2026-01-05",
      });

      const [updatedCash] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cashAccount.id));
      const [updatedCard] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cardAccount.id));
      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));
      const [reserveCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, debt.categoryId));

      expect(updatedCash.currentBalance).toBe("420.00");
      expect(updatedCard.currentBalance).toBe("0.00");
      expect(updatedCategory.allocatedBalance).toBe("0.00");
      expect(reserveCategory.allocatedBalance).toBe("0.00");
    });
  });

  it("rejects paying more than is reserved for a debt", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, {
        currentBalance: "400.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "50.00",
      });
      await createTestDebt(tx, user.id, cardAccount.id, {
        reserveBalance: "50.00",
      });

      await expect(
        recordDebtPayment(tx, user.id, {
          fromAccountId: cashAccount.id,
          debtAccountId: cardAccount.id,
          amount: "50.01",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientCategoryBalanceError);
    });
  });

  it("rejects paying a debt from a non-cash account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const notCash = await createTestAccount(tx, user.id, {
        type: "investment",
        isCashAccount: false,
        currentBalance: "1000.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "50.00",
      });
      await createTestDebt(tx, user.id, cardAccount.id);

      await expect(
        recordDebtPayment(tx, user.id, {
          fromAccountId: notCash.id,
          debtAccountId: cardAccount.id,
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects paying down an account that isn't a tracked debt", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, {
        currentBalance: "400.00",
      });
      const otherCash = await createTestAccount(tx, user.id, {
        currentBalance: "0",
      });

      await expect(
        recordDebtPayment(tx, user.id, {
          fromAccountId: cashAccount.id,
          debtAccountId: otherCash.id,
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
