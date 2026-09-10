import Link from "next/link";
import { phaseEnum } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard/queries";
import { updatePhase } from "./actions";
import { logout } from "./login/actions";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function Home() {
  const { userId } = await verifySession();
  const data = await getDashboardData(userId);

  return (
    <main>
      <h1>Ledger</h1>

      <nav>
        <Link href="/accounts">Accounts</Link> | <Link href="/categories">Categories</Link> |{" "}
        <Link href="/transactions">Transactions</Link> | <Link href="/income/new">Record Income</Link> |{" "}
        <Link href="/allocate">Allocate</Link> |{" "}
        <Link href="/allocate/quick">Quick Payout Allocation</Link> |{" "}
        <Link href="/rules">Allocation Rule Sets</Link>
      </nav>

      <section>
        <form action={updatePhase}>
          <label htmlFor="phase">Phase</label>
          <select id="phase" name="phase" defaultValue={data.phase}>
            {phaseEnum.enumValues.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <button type="submit">Update</button>
        </form>
      </section>

      <section>
        <h2>Overview</h2>
        <dl>
          <dt>Total Cash</dt>
          <dd>{formatCurrency(data.totalCash)}</dd>

          <dt>Unallocated Cash</dt>
          <dd>{formatCurrency(data.unallocatedCash)}</dd>

          <dt>Total Debt</dt>
          <dd>{formatCurrency(data.totalDebt)}</dd>

          <dt>Net Financial Position</dt>
          <dd>{formatCurrency(data.netFinancialPosition)}</dd>
        </dl>
      </section>

      <section>
        <h2>This Month</h2>
        <dl>
          <dt>Income</dt>
          <dd>{formatCurrency(data.incomeThisMonth)}</dd>

          <dt>Spending</dt>
          <dd>{formatCurrency(data.spendingThisMonth)}</dd>

          <dt>Debt Paid</dt>
          <dd>{formatCurrency(data.debtPaidThisMonth)}</dd>
        </dl>
      </section>

      <section>
        <h2>Fund Progress</h2>
        {data.goalProgress.length === 0 ? (
          <p>No goal categories with a target yet.</p>
        ) : (
          <ul>
            {data.goalProgress.map((goal) => {
              const percent = Math.min(
                100,
                Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
              );
              return (
                <li key={goal.name}>
                  {goal.name}: {formatCurrency(goal.allocatedBalance)} of{" "}
                  {formatCurrency(goal.targetAmount)} ({percent}%)
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>Earmarked</h2>
        {data.earmarked.length === 0 ? (
          <p>Nothing earmarked yet.</p>
        ) : (
          <ul>
            {data.earmarked.map((category) => (
              <li key={category.name}>
                {category.name}: {formatCurrency(category.allocatedBalance)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={logout}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
