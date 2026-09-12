import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { getSplitTransaction } from "@/lib/transactions/queries";
import { listCategories } from "@/lib/categories/queries";
import { listPayees } from "@/lib/payees/queries";
import { updateSplitExpenseAction } from "@/lib/transactions/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EditSplitExpenseForm } from "@/components/EditSplitExpenseForm";
import { errorBanner } from "@/lib/ui";

export default async function EditSplitExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { userId } = await verifySession();

  const [txn, categories, payees] = await Promise.all([
    getSplitTransaction(userId, id),
    listCategories(userId),
    listPayees(userId),
  ]);

  if (!txn) {
    notFound();
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Edit Split Expense" backHref="/transactions" backLabel="Transactions" />
      <p className="mb-4 text-sm text-text-secondary">{txn.accountName}</p>

      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}

      <Card>
        <EditSplitExpenseForm
          transactionId={txn.id}
          categories={categories}
          payees={payees}
          initialAmount={txn.amount}
          initialDate={txn.date}
          initialSource={txn.source ?? ""}
          initialSplits={txn.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount }))}
          action={updateSplitExpenseAction}
        />
      </Card>
    </div>
  );
}
