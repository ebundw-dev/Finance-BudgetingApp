import { notFound } from "next/navigation";
import { reconcileAccount } from "@/lib/accounts/actions";
import { verifySession } from "@/lib/auth/dal";
import { getAccount } from "@/lib/accounts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, currency, errorBanner, field, input, label as labelClass } from "@/lib/ui";

export default async function ReconcileAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const account = await getAccount(userId, id);

  if (!account) {
    notFound();
  }
  if (!account.isCashAccount) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={`Reconcile ${account.name}`}
        backHref="/accounts"
        backLabel="Accounts"
        subtitle="Match Ledger's computed balance against your real bank statement, and post an adjustment if they've drifted apart."
      />
      <Card className="max-w-md">
        <div className="mb-6 space-y-1">
          <p className="text-text-secondary text-xs">Ledger&apos;s computed balance</p>
          <p className="text-2xl font-semibold tabular-nums text-text">{currency(account.currentBalance)}</p>
          {account.lastReconciledAt ? (
            <p className="text-text-muted text-xs">
              Last reconciled {new Date(account.lastReconciledAt).toLocaleDateString()} at{" "}
              {currency(account.lastReconciledBalance ?? "0")}
            </p>
          ) : (
            <p className="text-text-muted text-xs">Never reconciled.</p>
          )}
        </div>

        <form action={reconcileAccount}>
          <input type="hidden" name="accountId" value={account.id} />
          <div className={field}>
            <label htmlFor="statementBalance" className={labelClass}>
              Statement balance (as of today)
            </label>
            <input
              id="statementBalance"
              name="statementBalance"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="notes" className={labelClass}>
              Notes (optional -- what explains the difference?)
            </label>
            <input id="notes" name="notes" type="text" className={input} />
          </div>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <p className="text-text-muted mb-4 text-xs">
            If the balances already match, this just records that you checked -- no adjustment is
            posted. If they don&apos;t, this posts a single adjustment transaction that corrects the
            difference; a surplus raises Unallocated Cash, a shortfall lowers it (and is rejected if
            there isn&apos;t enough Unallocated Cash to absorb it).
          </p>
          <SubmitButton className={buttonPrimary} pendingLabel="Reconciling…">
            Reconcile
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
