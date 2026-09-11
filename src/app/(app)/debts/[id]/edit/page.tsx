import { notFound } from "next/navigation";
import { updateDebt } from "@/lib/debts/actions";
import { verifySession } from "@/lib/auth/dal";
import { getDebt } from "@/lib/debts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, currency, errorBanner, field, input, label as labelClass } from "@/lib/ui";

export default async function EditDebtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const debt = await getDebt(userId, id);

  if (!debt) {
    notFound();
  }

  return (
    <div>
      <PageHeader title={`Edit ${debt.accountName}`} backHref="/debts" backLabel="Debts" />
      <p className="mb-6 text-sm text-text-secondary">
        Currently owes {currency(debt.currentBalance)}, reserve category &quot;{debt.categoryName}
        &quot; holds {currency(debt.reservedBalance)}.
      </p>
      <Card className="max-w-md">
        <form action={updateDebt}>
          <input type="hidden" name="debtId" value={debt.id} />
          <div className={field}>
            <label htmlFor="startingBalance" className={labelClass}>
              Starting balance
            </label>
            <input
              id="startingBalance"
              name="startingBalance"
              type="text"
              inputMode="decimal"
              defaultValue={debt.startingBalance}
              required
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="minimumPayment" className={labelClass}>
              Minimum payment (optional)
            </label>
            <input
              id="minimumPayment"
              name="minimumPayment"
              type="text"
              inputMode="decimal"
              defaultValue={debt.minimumPayment ?? ""}
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="apr" className={labelClass}>
              APR % (optional)
            </label>
            <input
              id="apr"
              name="apr"
              type="text"
              inputMode="decimal"
              defaultValue={debt.apr ?? ""}
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="targetPayoffDate" className={labelClass}>
              Target payoff date (optional)
            </label>
            <input
              id="targetPayoffDate"
              name="targetPayoffDate"
              type="date"
              defaultValue={debt.targetPayoffDate ?? ""}
              className={input}
            />
          </div>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <SubmitButton className={buttonPrimary}>Save</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
