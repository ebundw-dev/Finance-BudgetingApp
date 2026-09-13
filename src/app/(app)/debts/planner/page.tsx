import { verifySession } from "@/lib/auth/dal";
import { listDebts } from "@/lib/debts/queries";
import type { PlannerDebtInput } from "@/lib/debts/planner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { DebtPlannerClient } from "@/components/DebtPlannerClient";

export default async function DebtPlannerPage() {
  const { userId } = await verifySession();
  const debts = await listDebts(userId);

  // Only a debt with both an APR and a minimum payment set has enough
  // information for the simulation -- avalanche/snowball ordering and
  // interest accrual both need both fields.
  const plannerDebts: PlannerDebtInput[] = debts
    .filter((d) => d.apr !== null && d.minimumPayment !== null && Number(d.currentBalance) > 0)
    .map((d) => ({
      id: d.id,
      name: d.accountName,
      balance: Number(d.currentBalance),
      apr: Number(d.apr),
      minimumPayment: Number(d.minimumPayment),
    }));

  const skippedCount = debts.length - plannerDebts.length;

  return (
    <div>
      <PageHeader
        eyebrow="A genuine step past a spreadsheet"
        title="Debt Payoff Planner."
        subtitle="Compare avalanche (highest APR first) against snowball (lowest balance first) for your actual debts."
        backHref="/debts"
        backLabel="Debts"
      />

      {plannerDebts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No debts have both an APR and a minimum payment set (and a balance above zero) --
            add those from each debt&apos;s edit page before comparing payoff strategies.
          </p>
        </Card>
      ) : (
        <>
          {skippedCount > 0 ? (
            <p className="mb-6 text-xs text-text-muted">
              {skippedCount} debt{skippedCount === 1 ? "" : "s"} skipped (missing an APR, a minimum
              payment, or already at a zero balance).
            </p>
          ) : null}
          <DebtPlannerClient debts={plannerDebts} />
        </>
      )}
    </div>
  );
}
