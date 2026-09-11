import Link from "next/link";
import { phaseEnum } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard/queries";
import { Card, StatCard } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonSecondary, currency, select as selectClass } from "@/lib/ui";
import { updatePhase } from "./actions";

export default async function Home() {
  const { userId } = await verifySession();
  const data = await getDashboardData(userId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Dashboard</h1>
        <form action={updatePhase} className="flex items-center gap-2">
          <label htmlFor="phase" className="text-sm text-text-secondary">
            Phase
          </label>
          <select id="phase" name="phase" defaultValue={data.phase} className={`${selectClass} w-auto`}>
            {phaseEnum.enumValues.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <SubmitButton className={buttonSecondary} pendingLabel="Updating…">
            Update
          </SubmitButton>
        </form>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Cash" value={currency(data.totalCash)} />
        <StatCard label="Unallocated Cash" value={currency(data.unallocatedCash)} />
        <StatCard label="Total Debt" value={currency(data.totalDebt)} tone="danger" />
        <StatCard
          label="Net Financial Position"
          value={currency(data.netFinancialPosition)}
          tone={Number(data.netFinancialPosition) >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Income This Month" value={currency(data.incomeThisMonth)} tone="success" />
        <StatCard label="Spending This Month" value={currency(data.spendingThisMonth)} />
        <StatCard label="Debt Paid This Month" value={currency(data.debtPaidThisMonth)} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
            Fund Progress
          </h2>
          {data.goalProgress.length === 0 ? (
            <p className="text-sm text-text-muted">
              No goal categories with a target yet. Set one from{" "}
              <Link href="/categories" className="text-accent hover:underline">
                Categories
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-4">
              {data.goalProgress.map((goal) => {
                const percent = Math.round(
                  (Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100
                );
                return (
                  <li key={goal.name}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="text-text">{goal.name}</span>
                      <span className="tabular-nums text-text-secondary">
                        {currency(goal.allocatedBalance)} of {currency(goal.targetAmount)} (
                        {percent}%)
                      </span>
                    </div>
                    <ProgressBar percent={percent} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
            Earmarked
          </h2>
          {data.earmarked.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing earmarked yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.earmarked.map((category) => (
                <li key={category.name} className="flex justify-between text-sm">
                  <span className="text-text">{category.name}</span>
                  <span className="tabular-nums text-text-secondary">
                    {currency(category.allocatedBalance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
