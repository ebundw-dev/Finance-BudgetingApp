import { notFound } from "next/navigation";
import Link from "next/link";
import { updateDebt } from "@/lib/debts/actions";
import { verifySession } from "@/lib/auth/dal";
import { getDebt } from "@/lib/debts/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
    <main>
      <p>
        <Link href="/debts">Debts</Link>
      </p>
      <h1>Edit {debt.accountName}</h1>
      <p>
        Currently owes {formatCurrency(debt.currentBalance)}, reserve category &quot;
        {debt.categoryName}&quot; holds {formatCurrency(debt.reservedBalance)}.
      </p>
      <form action={updateDebt}>
        <input type="hidden" name="debtId" value={debt.id} />
        <div>
          <label htmlFor="startingBalance">Starting balance</label>
          <input
            id="startingBalance"
            name="startingBalance"
            type="text"
            inputMode="decimal"
            defaultValue={debt.startingBalance}
            required
          />
        </div>
        <div>
          <label htmlFor="minimumPayment">Minimum payment (optional)</label>
          <input
            id="minimumPayment"
            name="minimumPayment"
            type="text"
            inputMode="decimal"
            defaultValue={debt.minimumPayment ?? ""}
          />
        </div>
        <div>
          <label htmlFor="apr">APR % (optional)</label>
          <input id="apr" name="apr" type="text" inputMode="decimal" defaultValue={debt.apr ?? ""} />
        </div>
        <div>
          <label htmlFor="targetPayoffDate">Target payoff date (optional)</label>
          <input
            id="targetPayoffDate"
            name="targetPayoffDate"
            type="date"
            defaultValue={debt.targetPayoffDate ?? ""}
          />
        </div>
        <button type="submit">Save</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
