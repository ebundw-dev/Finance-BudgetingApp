import Link from "next/link";
import { listAccounts, listCashAccounts, listDebtAccounts } from "@/lib/accounts/queries";
import { listCategories } from "@/lib/categories/queries";
import type { scheduledTransactions } from "@/db/schema";
import { SubmitButton } from "@/components/SubmitButton";
import {
  buttonPrimary,
  errorBanner,
  field,
  input,
  label as labelClass,
  link,
  select as selectClass,
} from "@/lib/ui";

export type ScheduledType =
  | "income"
  | "expense"
  | "transfer"
  | "debt_payment"
  | "category_reallocation"
  | "allocation";

export const SCHEDULED_TYPE_LABELS: Record<ScheduledType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  debt_payment: "Debt Payment",
  category_reallocation: "Reallocation",
  allocation: "Allocation",
};

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
  custom_days: "Custom (days)",
};

type ExistingScheduled = typeof scheduledTransactions.$inferSelect;

// The shared body for both /scheduled/new and /scheduled/[id]/edit --
// which account/category fields show depends on `type`, same per-type
// column mapping as the transactions table (and transactions/new/page.tsx,
// which this mirrors). `existing` supplies defaults when editing.
export async function ScheduledTransactionFields({
  userId,
  type,
  action,
  error,
  existing,
}: {
  userId: string;
  type: ScheduledType;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  existing?: ExistingScheduled;
}) {
  const [accounts, cashAccounts, debtAccounts, categories] = await Promise.all([
    listAccounts(userId),
    listCashAccounts(userId),
    listDebtAccounts(userId),
    listCategories(userId),
  ]);
  const spendableAccounts = accounts.filter((a) => a.isCashAccount || a.type === "credit_card");

  const missing = (() => {
    if (type === "income" && cashAccounts.length === 0) return "a cash account";
    if (type === "expense" && (spendableAccounts.length === 0 || categories.length === 0)) {
      return "an account and a category";
    }
    if (type === "allocation" && categories.length === 0) return "a category";
    if (type === "transfer" && cashAccounts.length < 2) return "two cash accounts";
    if (type === "debt_payment" && (cashAccounts.length === 0 || debtAccounts.length === 0)) {
      return "a cash account and a tracked debt account";
    }
    if (type === "category_reallocation" && categories.length < 2) return "two categories";
    return null;
  })();

  if (missing) {
    return (
      <p className="text-sm text-text-muted">
        Need {missing} first.{" "}
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
    <form action={action}>
      <input type="hidden" name="type" value={type} />
      {existing ? <input type="hidden" name="scheduledId" value={existing.id} /> : null}

      {type === "income" ? (
        <div className={field}>
          <label htmlFor="accountId" className={labelClass}>
            Deposit into
          </label>
          <select
            id="accountId"
            name="accountId"
            required
            defaultValue={existing?.accountId ?? ""}
            className={selectClass}
          >
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "expense" ? (
        <>
          <div className={field}>
            <label htmlFor="accountId" className={labelClass}>
              Account
            </label>
            <select
              id="accountId"
              name="accountId"
              required
              defaultValue={existing?.accountId ?? ""}
              className={selectClass}
            >
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
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={existing?.categoryId ?? ""}
              className={selectClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {type === "allocation" ? (
        <div className={field}>
          <label htmlFor="categoryId" className={labelClass}>
            Allocate into
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={existing?.categoryId ?? ""}
            className={selectClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "transfer" ? (
        <>
          <div className={field}>
            <label htmlFor="accountId" className={labelClass}>
              From
            </label>
            <select
              id="accountId"
              name="accountId"
              required
              defaultValue={existing?.accountId ?? ""}
              className={selectClass}
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label htmlFor="relatedAccountId" className={labelClass}>
              To
            </label>
            <select
              id="relatedAccountId"
              name="relatedAccountId"
              required
              defaultValue={existing?.relatedAccountId ?? cashAccounts[1]?.id ?? ""}
              className={selectClass}
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {type === "debt_payment" ? (
        <>
          <div className={field}>
            <label htmlFor="accountId" className={labelClass}>
              Pay from
            </label>
            <select
              id="accountId"
              name="accountId"
              required
              defaultValue={existing?.accountId ?? ""}
              className={selectClass}
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label htmlFor="relatedAccountId" className={labelClass}>
              Pay down
            </label>
            <select
              id="relatedAccountId"
              name="relatedAccountId"
              required
              defaultValue={existing?.relatedAccountId ?? ""}
              className={selectClass}
            >
              {debtAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} (owes ${account.currentBalance})
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {type === "category_reallocation" ? (
        <>
          <div className={field}>
            <label htmlFor="categoryId" className={labelClass}>
              From
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={existing?.categoryId ?? ""}
              className={selectClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} (${category.allocatedBalance})
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label htmlFor="relatedCategoryId" className={labelClass}>
              To
            </label>
            <select
              id="relatedCategoryId"
              name="relatedCategoryId"
              required
              defaultValue={existing?.relatedCategoryId ?? categories[1]?.id ?? ""}
              className={selectClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div className={field}>
        <label htmlFor="description" className={labelClass}>
          Payee / description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          required
          defaultValue={existing?.description ?? ""}
          placeholder="e.g. Netflix, Rent, Car insurance"
          className={input}
        />
      </div>

      <div className={field}>
        <label htmlFor="amount" className={labelClass}>
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          defaultValue={existing?.amount ?? ""}
          className={input}
        />
      </div>

      <div className={field}>
        <label htmlFor="nextDueDate" className={labelClass}>
          Next due date
        </label>
        <input
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          required
          defaultValue={existing?.nextDueDate ?? ""}
          className={input}
        />
      </div>

      <div className={field}>
        <label htmlFor="cadence" className={labelClass}>
          Repeats
        </label>
        <select
          id="cadence"
          name="cadence"
          defaultValue={existing?.cadence ?? "monthly"}
          className={selectClass}
        >
          {Object.entries(CADENCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label htmlFor="intervalDays" className={labelClass}>
          Interval in days (only used for &quot;Custom&quot;)
        </label>
        <input
          id="intervalDays"
          name="intervalDays"
          type="text"
          inputMode="numeric"
          defaultValue={existing?.intervalDays ?? ""}
          className={input}
        />
      </div>

      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}

      <SubmitButton className={buttonPrimary} pendingLabel="Saving…">
        {existing ? "Save" : "Create Scheduled Transaction"}
      </SubmitButton>
    </form>
  );
}
