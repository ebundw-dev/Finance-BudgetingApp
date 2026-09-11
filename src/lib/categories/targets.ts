// Pure computation for category funding targets -- kept free of DB access
// so it's trivially unit testable, same rationale as
// src/lib/accounting/allocationRules.ts. Callers fetch the category row
// plus "allocated this month" (see getAllocatedThisMonthByCategory in
// queries.ts) and pass them in here.

export type TargetType = "refill_up_to" | "set_aside_monthly" | "by_date";

export interface CategoryTargetInput {
  targetType: TargetType | null;
  targetAmount: string | null;
  targetDate: string | null;
  allocatedBalance: string;
  allocatedThisMonth: string;
}

export interface RefillUpToStatus {
  targetType: "refill_up_to";
  underfunded: boolean;
  progressPercent: number;
}

export interface SetAsideMonthlyStatus {
  targetType: "set_aside_monthly";
  underfunded: boolean;
}

export interface ByDateStatus {
  targetType: "by_date";
  underfunded: boolean;
  monthlyNeeded: string;
  monthsRemaining: number;
}

export type CategoryTargetStatus = RefillUpToStatus | SetAsideMonthlyStatus | ByDateStatus;

// Whole calendar months between today and targetDate, floored at 1 so a
// due-this-month (or overdue) target still divides by something sane
// instead of by zero or a negative number -- the full remaining amount is
// then "needed this month" rather than the computation blowing up.
export function computeMonthsRemaining(targetDate: string, today: Date = new Date()): number {
  const [ty, tm] = targetDate.split("-").map(Number);
  const totalTargetMonths = ty * 12 + (tm - 1);
  const totalTodayMonths = today.getUTCFullYear() * 12 + today.getUTCMonth();
  return Math.max(1, totalTargetMonths - totalTodayMonths);
}

export function computeByDateMonthlyNeeded(
  targetAmount: number,
  allocatedBalance: number,
  monthsRemaining: number
): number {
  const remaining = Math.max(0, targetAmount - allocatedBalance);
  return remaining / monthsRemaining;
}

// Null when the category has no target set at all (targetType/targetAmount
// both null) -- callers should fall back to a flat balance display in that
// case, same as before target types existed.
export function getCategoryFundingStatus(
  input: CategoryTargetInput,
  today: Date = new Date()
): CategoryTargetStatus | null {
  if (!input.targetType || input.targetAmount === null) {
    return null;
  }

  const targetAmount = Number(input.targetAmount);
  const allocatedBalance = Number(input.allocatedBalance);
  const allocatedThisMonth = Number(input.allocatedThisMonth);

  if (input.targetType === "refill_up_to") {
    return {
      targetType: "refill_up_to",
      underfunded: allocatedBalance < targetAmount,
      progressPercent: targetAmount > 0 ? Math.round((allocatedBalance / targetAmount) * 100) : 100,
    };
  }

  if (input.targetType === "set_aside_monthly") {
    return {
      targetType: "set_aside_monthly",
      underfunded: allocatedThisMonth < targetAmount,
    };
  }

  // by_date
  const monthsRemaining = input.targetDate ? computeMonthsRemaining(input.targetDate, today) : 1;
  const monthlyNeeded = computeByDateMonthlyNeeded(targetAmount, allocatedBalance, monthsRemaining);
  return {
    targetType: "by_date",
    underfunded: allocatedThisMonth < monthlyNeeded - 0.001, // tolerate cent-level rounding
    monthlyNeeded: monthlyNeeded.toFixed(2),
    monthsRemaining,
  };
}
