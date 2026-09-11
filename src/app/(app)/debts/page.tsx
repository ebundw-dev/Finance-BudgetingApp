import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listDebts } from "@/lib/debts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { currency, link } from "@/lib/ui";

export default async function DebtsPage() {
  const { userId } = await verifySession();
  const debts = await listDebts(userId);

  return (
    <div>
      <div className="mb-6">
        <PageHeader title="Debts" />
        <p className="text-sm text-text-secondary">
          Add a new debt from{" "}
          <Link href="/accounts/new" className={link}>
            Add Account
          </Link>{" "}
          (check &quot;track this as a debt&quot;).
        </p>
      </div>
      {debts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No debts tracked yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Card key={debt.id}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h2 className="font-medium text-text">{debt.accountName}</h2>
                    <p className="text-xs text-text-muted">
                      Reserved: {currency(debt.reservedBalance)} ({debt.categoryName})
                    </p>
                  </div>
                  <Link href={`/debts/${debt.id}/edit`} className={`${link} text-xs`}>
                    Edit
                  </Link>
                </div>

                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-text-secondary">Owed</span>
                  <span className="tabular-nums font-semibold text-danger">
                    {currency(debt.currentBalance)}
                  </span>
                </div>

                {percent !== null ? (
                  <>
                    <ProgressBar percent={percent} />
                    <p className="mt-1 text-xs tabular-nums text-text-secondary">
                      {currency(eliminated.toFixed(2))} eliminated of {currency(debt.startingBalance)} ({percent}%)
                    </p>
                  </>
                ) : null}

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <dt>Min payment</dt>
                  <dd className="text-right tabular-nums text-text">
                    {debt.minimumPayment ? currency(debt.minimumPayment) : "—"}
                  </dd>
                  <dt>APR</dt>
                  <dd className="text-right tabular-nums text-text">
                    {debt.apr ? `${debt.apr}%` : "—"}
                  </dd>
                  <dt>Target payoff</dt>
                  <dd className="text-right text-text">{debt.targetPayoffDate ?? "—"}</dd>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
