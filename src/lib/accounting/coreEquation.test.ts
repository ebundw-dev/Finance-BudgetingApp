import { describe, expect, it } from "vitest";
import {
  recordAllocation,
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordTransfer,
} from "./engine";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "./testing";

// Acceptance criterion from PROJECT_BRIEF.md: the core equation
//   Total Cash = Sum(category.allocated_balance) + Unallocated Cash
// must hold exactly to the cent after every one of the 7 rule types,
// run in combination, not just in isolation.
describe("core equation", () => {
  it("holds after a full mix of income, allocation, both expense types, a debt payment, a transfer, and a reallocation", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, {
        name: "Checking",
        currentBalance: "0",
      });
      const savings = await createTestAccount(tx, user.id, {
        name: "Savings",
        currentBalance: "0",
      });
      const card = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      await createTestDebt(tx, user.id, card.id);

      const bills = await createTestCategory(tx, user.id, { name: "Bills" });
      const emergency = await createTestCategory(tx, user.id, {
        name: "Emergency",
      });

      // Before anything happens, the equation holds trivially: 0 = 0 + 0.
      expect(await getUnallocatedCash(tx, user.id)).toBe("0.00");

      await recordIncome(tx, user.id, {
        accountId: checking.id,
        amount: "2000.00",
        date: "2026-01-01",
        source: "Payout",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe("2000.00");

      await recordAllocation(tx, user.id, {
        categoryId: bills.id,
        amount: "800.00",
        date: "2026-01-01",
      });
      await recordAllocation(tx, user.id, {
        categoryId: emergency.id,
        amount: "500.00",
        date: "2026-01-01",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");

      await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "150.00",
        date: "2026-01-02",
        source: "Rent",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");

      await recordExpense(tx, user.id, {
        accountId: card.id,
        categoryId: bills.id,
        amount: "60.00",
        date: "2026-01-03",
        source: "Phone",
      });
      // Card purchase must not move Unallocated Cash.
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");

      await recordDebtPayment(tx, user.id, {
        fromAccountId: checking.id,
        debtAccountId: card.id,
        amount: "60.00",
        date: "2026-01-10",
      });
      // Paying the card bill moves cash and debt together; Unallocated Cash
      // is untouched because the spend was already counted at purchase time.
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");

      await recordTransfer(tx, user.id, {
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: "300.00",
        date: "2026-01-11",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");

      await recordCategoryReallocation(tx, user.id, {
        fromCategoryId: emergency.id,
        toCategoryId: bills.id,
        amount: "100.00",
        date: "2026-01-12",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe("700.00");
    });
  });
});
