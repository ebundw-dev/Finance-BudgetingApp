import { describe, expect, it } from "vitest";
import { ValidationError, NotFoundError } from "@/lib/accounting/errors";
import { createTestUser, withRollback } from "@/lib/accounting/testing";
import { createGoal, parseGoalInput, updateGoal } from "./goals";

describe("parseGoalInput", () => {
  it("rejects a missing name", () => {
    expect(() => parseGoalInput({ targetAmount: "100" })).toThrow(ValidationError);
  });

  it("rejects a non-positive target amount", () => {
    expect(() => parseGoalInput({ name: "Emergency Fund", targetAmount: "0" })).toThrow(ValidationError);
    expect(() => parseGoalInput({ name: "Emergency Fund", targetAmount: "-5" })).toThrow(ValidationError);
    expect(() => parseGoalInput({ name: "Emergency Fund", targetAmount: "abc" })).toThrow(ValidationError);
  });

  it("defaults targetDate/categoryId to null", () => {
    const input = parseGoalInput({ name: "Emergency Fund", targetAmount: "1000" });
    expect(input.targetDate).toBeNull();
    expect(input.categoryId).toBeNull();
  });
});

describe("createGoal", () => {
  it("inserts a goal for the user", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const goal = await createGoal(tx, user.id, {
        name: "Emergency Fund",
        targetAmount: "1000.00",
        targetDate: "2026-12-31",
        categoryId: null,
      });

      expect(goal.name).toBe("Emergency Fund");
      expect(goal.targetAmount).toBe("1000.00");
      expect(goal.userId).toBe(user.id);
    });
  });
});

describe("updateGoal", () => {
  it("updates an existing goal", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const goal = await createGoal(tx, user.id, {
        name: "Emergency Fund",
        targetAmount: "1000.00",
        targetDate: null,
        categoryId: null,
      });

      const updated = await updateGoal(tx, user.id, goal.id, {
        name: "New Car",
        targetAmount: "5000.00",
        targetDate: "2027-06-01",
        categoryId: null,
      });

      expect(updated.name).toBe("New Car");
      expect(updated.targetAmount).toBe("5000.00");
      expect(updated.targetDate).toBe("2027-06-01");
    });
  });

  it("throws NotFoundError for another user's goal", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const goal = await createGoal(tx, owner.id, {
        name: "Emergency Fund",
        targetAmount: "1000.00",
        targetDate: null,
        categoryId: null,
      });

      await expect(
        updateGoal(tx, intruder.id, goal.id, {
          name: "Hijacked",
          targetAmount: "1.00",
          targetDate: null,
          categoryId: null,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
