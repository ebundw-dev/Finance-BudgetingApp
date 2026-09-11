import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCashAccounts } from "@/lib/accounts/queries";
import { quickPayoutAction } from "@/lib/allocation/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, errorBanner, field, input, label as labelClass, link, select as selectClass } from "@/lib/ui";

export default async function QuickPayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const accounts = await listCashAccounts(userId);

  return (
    <div className="max-w-md">
      <PageHeader title="Quick Payout Allocation" backHref="/allocate" backLabel="Allocate" />
      <p className="mb-6 text-sm text-text-secondary">
        Record the deposit, then go straight to allocating it against your priority categories.
      </p>
      {accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No cash accounts yet.{" "}
            <Link href="/accounts/new" className={link}>
              Add one
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : (
        <Card>
          <form action={quickPayoutAction}>
            <div className={field}>
              <label htmlFor="accountId" className={labelClass}>
                Deposit into
              </label>
              <select id="accountId" name="accountId" required className={selectClass}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={field}>
              <label htmlFor="amount" className={labelClass}>
                Payout amount
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                required
                autoFocus
                className={input}
              />
            </div>
            <div className={field}>
              <label htmlFor="source" className={labelClass}>
                Source
              </label>
              <input
                id="source"
                name="source"
                type="text"
                placeholder="e.g. Trading payout"
                className={input}
              />
            </div>
            {error ? (
              <p role="alert" className={errorBanner}>
                {error}
              </p>
            ) : null}
            <SubmitButton className={buttonPrimary} pendingLabel="Recording…">
              Continue to Allocation
            </SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
