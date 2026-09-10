import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories } from "@/db/schema";
import { recordCategoryReallocation } from "./engine";
import { InsufficientCategoryBalanceError, ValidationError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordCategoryReallocation", () => {
  it("moves balance between categories without touching any account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "500.00",
      });
      const from = await createTestCategory(tx, user.id, {
        name: "From",
        allocatedBalance: "200.00",
      });
      const to = await createTestCategory(tx, user.id, {
        name: "To",
        allocatedBalance: "50.00",
      });

      const txn = await recordCategoryReallocation(tx, user.id, {
        fromCategoryId: from.id,
        toCategoryId: to.id,
        amount: "75.00",
        date: "2026-01-01",
      });

      expect(txn.type).toBe("category_reallocation");
      expect(txn.accountId).toBeNull();

      const [updatedAccount] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id));
      const [updatedFrom] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, from.id));
      const [updatedTo] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, to.id));

      expect(updatedAccount.currentBalance).toBe("500.00");
      expect(updatedFrom.allocatedBalance).toBe("125.00");
      expect(updatedTo.allocatedBalance).toBe("125.00");
    });
  });

  it("rejects moving more than the source category has", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const from = await createTestCategory(tx, user.id, {
        name: "From",
        allocatedBalance: "30.00",
      });
      const to = await createTestCategory(tx, user.id, { name: "To" });

      await expect(
        recordCategoryReallocation(tx, user.id, {
          fromCategoryId: from.id,
          toCategoryId: to.id,
          amount: "30.01",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientCategoryBalanceError);
    });
  });

  it("rejects reallocating a category to itself", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "50.00",
      });

      await expect(
        recordCategoryReallocation(tx, user.id, {
          fromCategoryId: category.id,
          toCategoryId: category.id,
          amount: "10.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
