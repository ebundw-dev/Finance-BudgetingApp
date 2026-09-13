// Pure debt-payoff simulation -- no DB access, same rationale as
// allocationRules.ts and categories/targets.ts. Compares two fixed
// payment-priority strategies against the exact same monthly cash flow
// (sum of every debt's minimum payment, plus one optional extra amount
// applied to whichever debt is highest-priority and still open):
//
//   avalanche: highest APR first -- minimizes total interest paid.
//   snowball:  lowest balance first -- pays off individual debts sooner,
//              which is the whole point of "snowballing" a freed-up
//              minimum payment into the next debt in line.
//
// Both strategies roll a paid-off debt's own minimum payment into the
// pool available for the next still-open debt the moment it's paid off
// (mid-simulation, not just at the end) -- without that, snowball in
// particular wouldn't behave like its real-world namesake.
export interface PlannerDebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number; // annual percentage, e.g. 24.99 for 24.99% APR
  minimumPayment: number;
}

export interface PlannerDebtResult {
  id: string;
  name: string;
  // null means it doesn't pay off within MAX_MONTHS at this payment
  // level (minimums can't outpace interest) -- the UI should say so
  // rather than claim a bogus date.
  payoffMonth: number | null;
  totalInterestPaid: string;
}

export interface PlannerStrategyResult {
  // Debt ids in the order this strategy prioritizes extra payments.
  order: string[];
  debts: PlannerDebtResult[];
  totalMonths: number | null;
  totalInterestPaid: string;
}

// A 50-year cap against an infinite loop when minimum payments can't
// even cover accruing interest (a genuinely possible input, not just a
// bug guard) -- past this point the projection isn't meaningful anyway.
const MAX_MONTHS = 600;
const EPSILON = 0.005;

function simulate(
  debts: PlannerDebtInput[],
  extraMonthlyPayment: number,
  compare: (a: PlannerDebtInput, b: PlannerDebtInput) => number
): PlannerStrategyResult {
  const sorted = [...debts].sort(compare);
  const remaining = new Map(sorted.map((d) => [d.id, d.balance]));
  const interestPaid = new Map(sorted.map((d) => [d.id, 0]));
  const payoffMonth = new Map<string, number>();

  let month = 0;
  let extraPool = extraMonthlyPayment;

  const isOpen = (id: string) => (remaining.get(id) ?? 0) > EPSILON;

  while (sorted.some((d) => isOpen(d.id)) && month < MAX_MONTHS) {
    month += 1;

    // Interest accrues on every still-open balance before any payment
    // this month is applied.
    for (const debt of sorted) {
      if (!isOpen(debt.id)) continue;
      const interest = remaining.get(debt.id)! * (debt.apr / 100 / 12);
      remaining.set(debt.id, remaining.get(debt.id)! + interest);
      interestPaid.set(debt.id, interestPaid.get(debt.id)! + interest);
    }

    let freedThisMonth = 0;

    // Every open debt gets at least its own minimum.
    for (const debt of sorted) {
      if (!isOpen(debt.id)) continue;
      const payment = Math.min(debt.minimumPayment, remaining.get(debt.id)!);
      remaining.set(debt.id, remaining.get(debt.id)! - payment);
      if (!isOpen(debt.id)) {
        payoffMonth.set(debt.id, month);
        freedThisMonth += debt.minimumPayment;
      }
    }

    // The extra pool (this month's extraMonthlyPayment, plus any
    // minimums freed up by an earlier payoff) goes entirely to the
    // highest-priority debt that's still open, then spills over to the
    // next one if it's more than enough to finish it off this month.
    let pool = extraPool;
    for (const debt of sorted) {
      if (pool <= EPSILON) break;
      if (!isOpen(debt.id)) continue;
      const payment = Math.min(pool, remaining.get(debt.id)!);
      remaining.set(debt.id, remaining.get(debt.id)! - payment);
      pool -= payment;
      if (!isOpen(debt.id) && !payoffMonth.has(debt.id)) {
        payoffMonth.set(debt.id, month);
        freedThisMonth += debt.minimumPayment;
      }
    }

    extraPool += freedThisMonth;
  }

  const results: PlannerDebtResult[] = sorted.map((debt) => ({
    id: debt.id,
    name: debt.name,
    payoffMonth: payoffMonth.get(debt.id) ?? null,
    totalInterestPaid: interestPaid.get(debt.id)!.toFixed(2),
  }));

  const allPaidOff = results.every((r) => r.payoffMonth !== null);
  const totalMonths = allPaidOff ? Math.max(0, ...results.map((r) => r.payoffMonth!)) : null;
  const totalInterestPaid = results.reduce((sum, r) => sum + Number(r.totalInterestPaid), 0).toFixed(2);

  return {
    order: sorted.map((d) => d.id),
    debts: results,
    totalMonths,
    totalInterestPaid,
  };
}

export interface PayoffComparison {
  avalanche: PlannerStrategyResult;
  snowball: PlannerStrategyResult;
}

export function comparePayoffStrategies(debts: PlannerDebtInput[], extraMonthlyPayment: number): PayoffComparison {
  const avalanche = simulate(debts, extraMonthlyPayment, (a, b) => b.apr - a.apr || b.balance - a.balance);
  const snowball = simulate(debts, extraMonthlyPayment, (a, b) => a.balance - b.balance || b.apr - a.apr);
  return { avalanche, snowball };
}

// Approximate calendar projection (year/month only matters -- this is a
// planning estimate, not a recorded transaction date, so it doesn't need
// the exact day-of-month clamping src/lib/scheduled/cadence.ts uses for
// real due dates).
export function projectPayoffDate(monthsFromNow: number, from: Date = new Date()): string {
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + monthsFromNow, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}
