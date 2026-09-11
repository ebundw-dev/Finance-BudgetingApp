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
import { listAccounts } from "@/lib/accounts/queries";
import { deleteAccount } from "@/lib/accounts/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { buttonPrimary, currency, errorBanner } from "@/lib/ui";

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit Card",
  investment: "Investment",
  other: "Other",
};

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

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId } = await verifySession();
  const [accounts, { error }] = await Promise.all([listAccounts(userId), searchParams]);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Where it lives"
          title="Your accounts."
          subtitle="Every place your money actually sits — cash and debt alike."
        />
        <Link href="/accounts/new" className={`${buttonPrimary} mt-1`}>
          Add account
        </Link>
      </div>
      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}
      {accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No accounts yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = TYPE_ICON[account.type] ?? CircleDollarSign;
            const badge = TYPE_BADGE[account.type] ?? "bg-text-secondary/10 text-text-secondary";
            return (
              <Card key={account.id}>
                <div className="mb-5 flex items-start justify-between gap-2">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badge}`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${badge}`}
                    >
                      {TYPE_LABELS[account.type] ?? account.type}
                    </span>
                    <form action={deleteAccount}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <ConfirmDeleteButton label={`Delete ${account.name}`} iconOnly />
                    </form>
                  </div>
                </div>
                <h2 className="mb-3 font-medium text-text">{account.name}</h2>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-text-secondary">
                    {account.isCashAccount ? "Balance" : "Owed"}
                  </span>
                  <span
                    className={`text-xl font-semibold tabular-nums ${
                      account.isCashAccount ? "text-text" : "text-danger"
                    }`}
                  >
                    {currency(account.currentBalance)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
