// Ported from src/lib/debts/planner.ts -- pure computation, no DB access,
// so it copies over verbatim. Keep in sync by hand if the web version's
// simulation logic ever changes; no shared package between the two apps.

export interface PlannerDebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
}

export interface PlannerDebtResult {
  id: string;
  name: string;
  payoffMonth: number | null;
  totalInterestPaid: string;
}

export interface PlannerStrategyResult {
  order: string[];
  debts: PlannerDebtResult[];
  totalMonths: number | null;
  totalInterestPaid: string;
}

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

    for (const debt of sorted) {
      if (!isOpen(debt.id)) continue;
      const interest = remaining.get(debt.id)! * (debt.apr / 100 / 12);
      remaining.set(debt.id, remaining.get(debt.id)! + interest);
      interestPaid.set(debt.id, interestPaid.get(debt.id)! + interest);
    }

    let freedThisMonth = 0;

    for (const debt of sorted) {
      if (!isOpen(debt.id)) continue;
      const payment = Math.min(debt.minimumPayment, remaining.get(debt.id)!);
      remaining.set(debt.id, remaining.get(debt.id)! - payment);
      if (!isOpen(debt.id)) {
        payoffMonth.set(debt.id, month);
        freedThisMonth += debt.minimumPayment;
      }
    }

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

export function projectPayoffDate(monthsFromNow: number, from: Date = new Date()): string {
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + monthsFromNow, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}
