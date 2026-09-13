import Link from "next/link";
import {
  Landmark,
  PiggyBank,
  Banknote,
  CreditCard,
  TrendingUp,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { verifySession } from "@/lib/auth/dal";
import { listDebts } from "@/lib/debts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { buttonSecondary, currency, link } from "@/lib/ui";

// Same account-type -> icon/badge mapping as src/app/(app)/accounts/page.tsx
// -- a debt's card shows the same icon its underlying account does there,
// since every debt is exactly one account.
const TYPE_ICON: Record<string, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  credit_card: CreditCard,
  investment: TrendingUp,
  other: CircleDollarSign,
};

const TYPE_BADGE: Record<string, string> = {
  checking: "bg-accent/12 text-accent",
  savings: "bg-success/12 text-success",
  cash: "bg-success/12 text-success",
  credit_card: "bg-danger/12 text-danger",
  investment: "bg-info/12 text-info",
  other: "bg-text-secondary/10 text-text-secondary",
};

export default async function DebtsPage() {
  const { userId } = await verifySession();
  const debts = await listDebts(userId);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Make it smaller"
          title="Debts."
          subtitle="What remains, what you're paying, and how fast it's shrinking."
        />
        <Link href="/debts/planner" className={`${buttonSecondary} mt-1`}>
          Payoff planner
        </Link>
      </div>
      <p className="mb-10 text-sm text-text-secondary">
        Add a new debt from{" "}
        <Link href="/accounts/new" className={link}>
          Add Account
        </Link>{" "}
        (check &quot;track this as a debt&quot;).
      </p>
      {debts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No debts tracked yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
            const Icon = TYPE_ICON[debt.accountType] ?? CircleDollarSign;
            const badge = TYPE_BADGE[debt.accountType] ?? "bg-text-secondary/10 text-text-secondary";

            return (
              <Card key={debt.id}>
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badge}`}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="font-medium text-text">{debt.accountName}</h2>
                      <p className="text-xs text-text-muted">
                        Reserved: {currency(debt.reservedBalance)} ({debt.categoryName})
                      </p>
                    </div>
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
