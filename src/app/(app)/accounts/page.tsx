import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listAccounts } from "@/lib/accounts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, currency } from "@/lib/ui";

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit Card",
  investment: "Investment",
  other: "Other",
};

const TYPE_BADGE: Record<string, string> = {
  checking: "bg-accent/15 text-accent",
  savings: "bg-success/15 text-success",
  cash: "bg-success/15 text-success",
  credit_card: "bg-danger/15 text-danger",
  investment: "bg-warning/15 text-warning",
  other: "bg-surface-hover text-text-secondary",
};

export default async function AccountsPage() {
  const { userId } = await verifySession();
  const accounts = await listAccounts(userId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Accounts" />
        <Link href="/accounts/new" className={buttonPrimary}>
          Add account
        </Link>
      </div>
      {accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No accounts yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="font-medium text-text">{account.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[account.type] ?? "bg-surface-hover text-text-secondary"}`}
                >
                  {TYPE_LABELS[account.type] ?? account.type}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-secondary">
                  {account.isCashAccount ? "Balance" : "Owed"}
                </span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    account.isCashAccount ? "text-text" : "text-danger"
                  }`}
                >
                  {currency(account.currentBalance)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
