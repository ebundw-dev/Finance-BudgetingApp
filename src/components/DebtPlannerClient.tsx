"use client";

import { useMemo, useState } from "react";
import { comparePayoffStrategies, projectPayoffDate, type PlannerDebtInput, type PlannerStrategyResult } from "@/lib/debts/planner";
import { Card } from "@/components/Card";
import { currency, field, input as inputClass, label as labelClass, table, td, th } from "@/lib/ui";

export function DebtPlannerClient({ debts }: { debts: PlannerDebtInput[] }) {
  const [extra, setExtra] = useState("0");
  const extraValue = Number(extra) || 0;

  const { avalanche, snowball } = useMemo(
    () => comparePayoffStrategies(debts, extraValue),
    [debts, extraValue]
  );

  const cheaper = Number(avalanche.totalInterestPaid) <= Number(snowball.totalInterestPaid) ? "avalanche" : "snowball";

  return (
    <div>
      <Card className="mb-6 max-w-sm">
        <div className={field}>
          <label htmlFor="extra" className={labelClass}>
            Extra monthly payment (on top of every debt&apos;s minimum)
          </label>
          <input
            id="extra"
            type="text"
            inputMode="decimal"
            className={inputClass}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>
        <p className="text-text-muted text-xs">
          Applied entirely to the highest-priority debt still open under each strategy -- a paid-off
          debt&apos;s own minimum payment rolls into that pool the month it&apos;s paid off, same as a
          real debt snowball or avalanche.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StrategyCard
          title="Avalanche"
          description="Highest APR first -- minimizes total interest paid."
          result={avalanche}
          debts={debts}
          recommended={cheaper === "avalanche"}
        />
        <StrategyCard
          title="Snowball"
          description="Lowest balance first -- pays off individual debts sooner."
          result={snowball}
          debts={debts}
          recommended={cheaper === "snowball"}
        />
      </div>
    </div>
  );
}

function StrategyCard({
  title,
  description,
  result,
  debts,
  recommended,
}: {
  title: string;
  description: string;
  result: PlannerStrategyResult;
  debts: PlannerDebtInput[];
  recommended: boolean;
}) {
  const debtName = (id: string) => debts.find((d) => d.id === id)?.name ?? id;

  return (
    <Card padded={false}>
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-text">{title}</h2>
          {recommended ? (
            <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
              Less total interest
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-secondary">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 py-4 text-sm">
        <div>
          <p className="text-text-secondary text-xs">Payoff date</p>
          <p className="font-semibold tabular-nums text-text">
            {result.totalMonths !== null ? projectPayoffDate(result.totalMonths) : "50+ years"}
          </p>
        </div>
        <div>
          <p className="text-text-secondary text-xs">Total interest</p>
          <p className="font-semibold tabular-nums text-text">{currency(result.totalInterestPaid)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Debt</th>
              <th className={th}>Paid off</th>
              <th className={th}>Interest</th>
            </tr>
          </thead>
          <tbody>
            {result.order.map((id) => {
              const debt = result.debts.find((d) => d.id === id)!;
              return (
                <tr key={id}>
                  <td className={td}>{debtName(id)}</td>
                  <td className={`${td} tabular-nums`}>
                    {debt.payoffMonth !== null ? projectPayoffDate(debt.payoffMonth) : "50+ years"}
                  </td>
                  <td className={`${td} tabular-nums`}>{currency(debt.totalInterestPaid)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
