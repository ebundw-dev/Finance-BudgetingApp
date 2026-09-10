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
    <main>
      <p>
        <Link href="/transactions">Transactions</Link>
      </p>
      <h1>New Transaction</h1>
      <nav>
        {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
          <span key={t}>
            {t === type ? (
              <strong>{TYPE_LABELS[t]}</strong>
            ) : (
              <Link href={`/transactions/new?type=${t}`}>{TYPE_LABELS[t]}</Link>
            )}
            {" | "}
          </span>
        ))}
      </nav>

      {type === "expense" && <ExpenseForm userId={userId} />}
      {type === "transfer" && <TransferForm userId={userId} />}
      {type === "debt-payment" && <DebtPaymentForm userId={userId} />}
      {type === "reallocation" && <ReallocationForm userId={userId} />}

      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}

async function ExpenseForm({ userId }: { userId: string }) {
  const [accounts, categories] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
  ]);
  const spendableAccounts = accounts.filter(
    (a) => a.isCashAccount || a.type === "credit_card"
  );

  if (spendableAccounts.length === 0 || categories.length === 0) {
    return (
      <p>
        Need at least one account and one category first. <Link href="/accounts/new">Add an account</Link>{" "}
        or <Link href="/categories/new">add a category</Link>.
      </p>
    );
  }

  return (
    <form action={recordExpenseAction}>
      <div>
        <label htmlFor="accountId">Account</label>
        <select id="accountId" name="accountId" required>
          {spendableAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="categoryId">Category</label>
        <select id="categoryId" name="categoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" name="amount" type="text" inputMode="decimal" required />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={todayStr()} />
      </div>
      <div>
        <label htmlFor="source">Merchant / source</label>
        <input id="source" name="source" type="text" />
      </div>
      <button type="submit">Record Expense</button>
    </form>
  );
}

async function TransferForm({ userId }: { userId: string }) {
  const accounts = await listCashAccounts(userId);

  if (accounts.length < 2) {
    return (
      <p>
        Need at least two cash accounts to transfer between.{" "}
        <Link href="/accounts/new">Add one</Link>.
      </p>
    );
  }

  return (
    <form action={recordTransferAction}>
      <div>
        <label htmlFor="fromAccountId">From</label>
        <select id="fromAccountId" name="fromAccountId" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="toAccountId">To</label>
        <select id="toAccountId" name="toAccountId" required defaultValue={accounts[1]?.id}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" name="amount" type="text" inputMode="decimal" required />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={todayStr()} />
      </div>
      <button type="submit">Record Transfer</button>
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
      <p>
        Need a cash account and a tracked debt account.{" "}
        <Link href="/accounts/new">Add an account</Link> (check &quot;track this as a debt&quot;).
      </p>
    );
  }

  return (
    <form action={recordDebtPaymentAction}>
      <div>
        <label htmlFor="fromAccountId">Pay from</label>
        <select id="fromAccountId" name="fromAccountId" required>
          {cashAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="debtAccountId">Pay down</label>
        <select id="debtAccountId" name="debtAccountId" required>
          {debtAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} (owes ${account.currentBalance})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" name="amount" type="text" inputMode="decimal" required />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={todayStr()} />
      </div>
      <button type="submit">Record Debt Payment</button>
    </form>
  );
}

async function ReallocationForm({ userId }: { userId: string }) {
  const categories = await listCategories(userId);

  if (categories.length < 2) {
    return <p>Need at least two categories to move money between them.</p>;
  }

  return (
    <form action={recordCategoryReallocationAction}>
      <div>
        <label htmlFor="fromCategoryId">From</label>
        <select id="fromCategoryId" name="fromCategoryId" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} (${category.allocatedBalance})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="toCategoryId">To</label>
        <select id="toCategoryId" name="toCategoryId" required defaultValue={categories[1]?.id}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" name="amount" type="text" inputMode="decimal" required />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={todayStr()} />
      </div>
      <button type="submit">Move Money</button>
    </form>
  );
}
