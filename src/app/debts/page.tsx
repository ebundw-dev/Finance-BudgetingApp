import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listDebts } from "@/lib/debts/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DebtsPage() {
  const { userId } = await verifySession();
  const debts = await listDebts(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Debts</h1>
      <p>
        Add a new debt from <Link href="/accounts/new">Add Account</Link> (check &quot;track this
        as a debt&quot;).
      </p>
      {debts.length === 0 ? (
        <p>No debts tracked yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Debt</th>
              <th>Owed</th>
              <th>Reserved (category)</th>
              <th>Starting Balance</th>
              <th>Eliminated</th>
              <th>Min Payment</th>
              <th>APR</th>
              <th>Target Payoff</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {debts.map((debt) => {
              const starting = Number(debt.startingBalance);
              const current = Number(debt.currentBalance);
              const eliminated = starting - current;
              // "Eliminated" only means something for a debt that already
              // had a balance when tracking began (e.g. a loan from before
              // using the app). A debt that started at $0 and has since
              // been used normally isn't being "eliminated" -- it's just
              // being carried -- so there's nothing meaningful to show.
              const percent = starting > 0 ? Math.round((eliminated / starting) * 100) : null;

              return (
                <tr key={debt.id}>
                  <td>{debt.accountName}</td>
                  <td>{formatCurrency(debt.currentBalance)}</td>
                  <td>
                    {formatCurrency(debt.reservedBalance)} ({debt.categoryName})
                  </td>
                  <td>{formatCurrency(debt.startingBalance)}</td>
                  <td>
                    {starting > 0
                      ? `${formatCurrency(eliminated.toFixed(2))} (${percent}%)`
                      : "—"}
                  </td>
                  <td>{debt.minimumPayment ? formatCurrency(debt.minimumPayment) : "—"}</td>
                  <td>{debt.apr ? `${debt.apr}%` : "—"}</td>
                  <td>{debt.targetPayoffDate ?? "—"}</td>
                  <td>
                    <Link href={`/debts/${debt.id}/edit`}>Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
