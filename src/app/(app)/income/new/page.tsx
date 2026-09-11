import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCashAccounts } from "@/lib/accounts/queries";
import { recordIncomeAction } from "@/lib/transactions/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, errorBanner, field, input, label as labelClass, link, select as selectClass } from "@/lib/ui";

export default async function NewIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const accounts = await listCashAccounts(userId);

  return (
    <div>
      <PageHeader title="Record Income" />
      {accounts.length === 0 ? (
        <Card className="max-w-md">
          <p className="text-sm text-text-muted">
            No cash accounts yet.{" "}
            <Link href="/accounts/new" className={link}>
              Add one
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : (
        <Card className="max-w-md">
          <form action={recordIncomeAction}>
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
                Amount
              </label>
              <input id="amount" name="amount" type="text" inputMode="decimal" required className={input} />
            </div>
            <div className={field}>
              <label htmlFor="date" className={labelClass}>
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
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
            <div className={field}>
              <label htmlFor="notes" className={labelClass}>
                Notes
              </label>
              <input id="notes" name="notes" type="text" className={input} />
            </div>
            {error ? (
              <p role="alert" className={errorBanner}>
                {error}
              </p>
            ) : null}
            <SubmitButton className={buttonPrimary} pendingLabel="Recording…">
              Record Income
            </SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
