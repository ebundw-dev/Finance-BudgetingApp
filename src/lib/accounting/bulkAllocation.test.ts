import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { categories } from "@/db/schema";
import { recordBulkAllocation } from "./engine";
import { InsufficientUnallocatedCashError, ValidationError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "./testing";

describe("recordBulkAllocation", () => {
  it("distributes across several categories atomically", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "1000.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills" });
      const emergency = await createTestCategory(tx, user.id, { name: "Emergency" });
      const car = await createTestCategory(tx, user.id, { name: "Car" });

      const created = await recordBulkAllocation(
        tx,
        user.id,
        [
          { categoryId: bills.id, amount: "400.00" },
          { categoryId: emergency.id, amount: "350.00" },
          { categoryId: car.id, amount: "250.00" },
        ],
        { date: "2026-01-01" }
      );

      expect(created).toHaveLength(3);
      expect(created.every((txn) => txn.type === "allocation")).toBe(true);

      const [updatedBills] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      const [updatedEmergency] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, emergency.id));
      const [updatedCar] = await tx.select().from(categories).where(eq(categories.id, car.id));

      expect(updatedBills.allocatedBalance).toBe("400.00");
      expect(updatedEmergency.allocatedBalance).toBe("350.00");
      expect(updatedCar.allocatedBalance).toBe("250.00");
      expect(await getUnallocatedCash(tx, user.id)).toBe("0.00");
    });
  });

  it("skips zero-amount rows without error", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills" });
      const emergency = await createTestCategory(tx, user.id, { name: "Emergency" });

      const created = await recordBulkAllocation(
        tx,
        user.id,
        [
          { categoryId: bills.id, amount: "100.00" },
          { categoryId: emergency.id, amount: "0" },
        ],
        { date: "2026-01-01" }
      );

      expect(created).toHaveLength(1);
      const [updatedEmergency] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, emergency.id));
      expect(updatedEmergency.allocatedBalance).toBe("0.00");
    });
  });

  it("rejects a batch whose total exceeds Unallocated Cash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills" });
      const emergency = await createTestCategory(tx, user.id, { name: "Emergency" });

      await expect(
        recordBulkAllocation(
          tx,
          user.id,
          [
            { categoryId: bills.id, amount: "60.00" },
            { categoryId: emergency.id, amount: "40.01" },
          ],
          { date: "2026-01-01" }
        )
      ).rejects.toThrow(InsufficientUnallocatedCashError);
    });
  });

  it("rejects a batch with no positive amounts", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills" });

      await expect(
        recordBulkAllocation(tx, user.id, [{ categoryId: bills.id, amount: "0" }], {
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects duplicate categories in the same batch", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills" });

      await expect(
        recordBulkAllocation(
          tx,
          user.id,
          [
            { categoryId: bills.id, amount: "10.00" },
            { categoryId: bills.id, amount: "20.00" },
          ],
          { date: "2026-01-01" }
        )
      ).rejects.toThrow(ValidationError);
    });
  });
});
