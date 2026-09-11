import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listAccounts, listCashAccounts, listDebtAccounts } from "@/lib/accounts/queries";
import { listCategories } from "@/lib/categories/queries";
import {
  recordCategoryReallocationAction,
  recordDebtPaymentAction,
  recordExpenseAction,
  recordTransferAction,
} from "@/lib/transactions/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, errorBanner, field, input, label as labelClass, link, select as selectClass } from "@/lib/ui";

type TransactionType = "expense" | "transfer" | "debt-payment" | "reallocation";

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  transfer: "Transfer",
  "debt-payment": "Debt Payment",
  reallocation: "Category Reallocation",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const { type: typeParam, error } = await searchParams;
  const type: TransactionType =
    typeParam === "transfer" || typeParam === "debt-payment" || typeParam === "reallocation"
      ? typeParam
      : "expense";

  const { userId } = await verifySession();

  return (
    <div className="max-w-md">
      <PageHeader title="New Transaction" backHref="/transactions" backLabel="Transactions" />
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
          <Link
            key={t}
            href={`/transactions/new?type=${t}`}
            className={
              "rounded-full px-3 py-1 text-sm transition-colors " +
              (t === type
                ? "bg-accent/15 text-accent font-medium"
                : "bg-surface text-text-secondary hover:text-text border border-border")
            }
          >
            {TYPE_LABELS[t]}
          </Link>
        ))}
      </div>

      <Card>
        {type === "expense" && <ExpenseForm userId={userId} />}
        {type === "transfer" && <TransferForm userId={userId} />}
        {type === "debt-payment" && <DebtPaymentForm userId={userId} />}
        {type === "reallocation" && <ReallocationForm userId={userId} />}

        {error ? (
          <p role="alert" className={errorBanner}>
            {error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

async function ExpenseForm({ userId }: { userId: string }) {
  const [accounts, categories] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
  ]);
  const spendableAccounts = accounts.filter((a) => a.isCashAccount || a.type === "credit_card");

  if (spendableAccounts.length === 0 || categories.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Need at least one account and one category first.{" "}
        <Link href="/accounts/new" className={link}>
          Add an account
        </Link>{" "}
        or{" "}
        <Link href="/categories/new" className={link}>
          add a category
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={recordExpenseAction}>
      <div className={field}>
        <label htmlFor="accountId" className={labelClass}>
          Account
        </label>
        <select id="accountId" name="accountId" required className={selectClass}>
          {spendableAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="categoryId" className={labelClass}>
          Category
        </label>
        <select id="categoryId" name="categoryId" required className={selectClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
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
        <input id="date" name="date" type="date" defaultValue={todayStr()} className={input} />
      </div>
      <div className={field}>
        <label htmlFor="source" className={labelClass}>
          Merchant / source
        </label>
        <input id="source" name="source" type="text" className={input} />
      </div>
      <button type="submit" className={buttonPrimary}>
        Record Expense
      </button>
    </form>
  );
}

async function TransferForm({ userId }: { userId: string }) {
  const accounts = await listCashAccounts(userId);

  if (accounts.length < 2) {
    return (
      <p className="text-sm text-text-muted">
        Need at least two cash accounts to transfer between.{" "}
        <Link href="/accounts/new" className={link}>
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={recordTransferAction}>
      <div className={field}>
        <label htmlFor="fromAccountId" className={labelClass}>
          From
        </label>
        <select id="fromAccountId" name="fromAccountId" required className={selectClass}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="toAccountId" className={labelClass}>
          To
        </label>
        <select
          id="toAccountId"
          name="toAccountId"
          required
          defaultValue={accounts[1]?.id}
          className={selectClass}
        >
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
        <input id="date" name="date" type="date" defaultValue={todayStr()} className={input} />
      </div>
      <button type="submit" className={buttonPrimary}>
        Record Transfer
      </button>
    </form>
  );
}

async function DebtPaymentForm({ userId }: { userId: string }) {
  const [cashAccounts, debtAccounts] = await Promise.all([
    listCashAccounts(userId),
    listDebtAccounts(userId),
  ]);

  if (cashAccounts.length === 0 || debtAccounts.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Need a cash account and a tracked debt account.{" "}
        <Link href="/accounts/new" className={link}>
          Add an account
        </Link>{" "}
        (check &quot;track this as a debt&quot;).
      </p>
    );
  }

  return (
    <form action={recordDebtPaymentAction}>
      <div className={field}>
        <label htmlFor="fromAccountId" className={labelClass}>
          Pay from
        </label>
        <select id="fromAccountId" name="fromAccountId" required className={selectClass}>
          {cashAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="debtAccountId" className={labelClass}>
          Pay down
        </label>
        <select id="debtAccountId" name="debtAccountId" required className={selectClass}>
          {debtAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} (owes ${account.currentBalance})
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
        <input id="date" name="date" type="date" defaultValue={todayStr()} className={input} />
      </div>
      <button type="submit" className={buttonPrimary}>
        Record Debt Payment
      </button>
    </form>
  );
}

async function ReallocationForm({ userId }: { userId: string }) {
  const categories = await listCategories(userId);

  if (categories.length < 2) {
    return (
      <p className="text-sm text-text-muted">Need at least two categories to move money between them.</p>
    );
  }

  return (
    <form action={recordCategoryReallocationAction}>
      <div className={field}>
        <label htmlFor="fromCategoryId" className={labelClass}>
          From
        </label>
        <select id="fromCategoryId" name="fromCategoryId" required className={selectClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} (${category.allocatedBalance})
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor="toCategoryId" className={labelClass}>
          To
        </label>
        <select
          id="toCategoryId"
          name="toCategoryId"
          required
          defaultValue={categories[1]?.id}
          className={selectClass}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
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
        <input id="date" name="date" type="date" defaultValue={todayStr()} className={input} />
      </div>
      <button type="submit" className={buttonPrimary}>
        Move Money
      </button>
    </form>
  );
}
