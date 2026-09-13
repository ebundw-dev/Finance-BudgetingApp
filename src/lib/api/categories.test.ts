import { describe, expect, it } from "vitest";
import { ValidationError, NotFoundError } from "@/lib/accounting/errors";
import {
  createTestCategory,
  createTestUser,
  withRollback,
  type TestTx,
} from "@/lib/accounting/testing";
import { categoryGroups } from "@/db/schema";
import {
  createCategory,
  deleteCategory,
  parseCreateCategoryInput,
  parseUpdateCategoryInput,
  updateCategory,
} from "./categories";

async function createTestGroup(tx: TestTx, userId: string, name = "Test Group") {
  const [group] = await tx.insert(categoryGroups).values({ userId, name }).returning();
  return group;
}

describe("parseCreateCategoryInput", () => {
  it("rejects a missing groupId/name", () => {
    expect(() => parseCreateCategoryInput({ name: "Rent" })).toThrow(ValidationError);
    expect(() => parseCreateCategoryInput({ groupId: "g1" })).toThrow(ValidationError);
  });

  it("rejects an invalid categoryType", () => {
    expect(() => parseCreateCategoryInput({ groupId: "g1", name: "Rent", categoryType: "bogus" })).toThrow(
      ValidationError
    );
  });

  it("defaults categoryType to spending", () => {
    const input = parseCreateCategoryInput({ groupId: "g1", name: "Rent" });
    expect(input.categoryType).toBe("spending");
  });
});

describe("createCategory", () => {
  it("inserts a category with allocatedBalance 0", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const group = await createTestGroup(tx, user.id);
      const category = await createCategory(tx, user.id, { groupId: group.id, name: "Rent", categoryType: "spending" });
      expect(category.name).toBe("Rent");
      expect(category.allocatedBalance).toBe("0.00");
    });
  });
});

describe("parseUpdateCategoryInput", () => {
  it("rejects a missing name", () => {
    expect(() => parseUpdateCategoryInput({})).toThrow(ValidationError);
  });

  it("rejects an invalid priority", () => {
    expect(() => parseUpdateCategoryInput({ name: "Rent", priority: "P9" })).toThrow(ValidationError);
  });

  it("clears all target fields when targetType is empty", () => {
    const input = parseUpdateCategoryInput({ name: "Rent", targetType: "" });
    expect(input.targetType).toBeNull();
    expect(input.targetAmount).toBeNull();
    expect(input.targetCadence).toBeNull();
    expect(input.targetDate).toBeNull();
  });

  it("requires a positive targetAmount when targetType is set", () => {
    expect(() => parseUpdateCategoryInput({ name: "Rent", targetType: "refill_up_to" })).toThrow(ValidationError);
    expect(() => parseUpdateCategoryInput({ name: "Rent", targetType: "refill_up_to", targetAmount: "0" })).toThrow(
      ValidationError
    );
  });

  it("accepts targetCadence only for refill_up_to, and only optionally", () => {
    const input = parseUpdateCategoryInput({
      name: "Rent",
      targetType: "refill_up_to",
      targetAmount: "100",
      targetCadence: "monthly",
    });
    expect(input.targetCadence).toBe("monthly");

    const withoutCadence = parseUpdateCategoryInput({
      name: "Rent",
      targetType: "refill_up_to",
      targetAmount: "100",
    });
    expect(withoutCadence.targetCadence).toBeNull();

    // by_date ignores a supplied targetCadence entirely.
    const byDate = parseUpdateCategoryInput({
      name: "Rent",
      targetType: "by_date",
      targetAmount: "100",
      targetCadence: "monthly",
      targetDate: "2026-12-31",
    });
    expect(byDate.targetCadence).toBeNull();
  });

  it("requires targetDate for by_date", () => {
    expect(() => parseUpdateCategoryInput({ name: "Rent", targetType: "by_date", targetAmount: "100" })).toThrow(
      ValidationError
    );
  });
});

describe("updateCategory", () => {
  it("updates name/target fields/priority/isArchived", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const category = await createTestCategory(tx, user.id, { name: "Rent" });

      const updated = await updateCategory(tx, user.id, category.id, {
        name: "Rent (updated)",
        targetType: "by_date",
        targetAmount: "1200.00",
        targetCadence: null,
        targetDate: "2027-01-01",
        priority: "P1",
        isArchived: false,
      });

      expect(updated.name).toBe("Rent (updated)");
      expect(updated.targetType).toBe("by_date");
      expect(updated.targetAmount).toBe("1200.00");
      expect(updated.priority).toBe("P1");
    });
  });

  it("throws NotFoundError for another user's category", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const category = await createTestCategory(tx, owner.id, { name: "Rent" });

      await expect(
        updateCategory(tx, intruder.id, category.id, {
          name: "Hijacked",
          targetType: null,
          targetAmount: null,
          targetCadence: null,
          targetDate: null,
          priority: null,
          isArchived: false,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});

describe("deleteCategory", () => {
  it("hard-deletes a category with a zero balance and no history", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const category = await createTestCategory(tx, user.id, { name: "Rent", allocatedBalance: "0" });

      const result = await deleteCategory(tx, user.id, category.id);
      expect(result.deleted).toBe(true);
    });
  });

  it("rejects deleting a category with a nonzero balance", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const category = await createTestCategory(tx, user.id, { name: "Rent", allocatedBalance: "50.00" });

      await expect(deleteCategory(tx, user.id, category.id)).rejects.toThrow(ValidationError);
    });
  });

  it("throws NotFoundError for a nonexistent category", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await expect(deleteCategory(tx, user.id, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
