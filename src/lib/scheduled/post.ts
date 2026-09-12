import {
  recordAllocation,
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordTransfer,
  type Tx,
} from "@/lib/accounting/engine";
import type { scheduledTransactions } from "@/db/schema";

type ScheduledRow = typeof scheduledTransactions.$inferSelect;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Dispatches to the same accounting engine function a manual entry of this
// type would use, with the scheduled transaction's stored account/
// category ids -- the mapping mirrors the transactions table's own
// column-usage comment in schema.ts exactly. Posts as of today (not the
// possibly-overdue nextDueDate), same as confirming any other pending
// action. Never touches transactions/categories/accounts outside of these
// existing engine functions. A plain module (not a "use server" action)
// so both the web confirm action (src/lib/scheduled/actions.ts) and the
// API's confirm route (src/app/api/scheduled/[id]/confirm/route.ts) can
// call it directly -- it takes a raw Tx handle, which couldn't be an
// exported Server Action itself (those must be callable with only
// serializable arguments).
export async function postScheduled(tx: Tx, userId: string, scheduled: ScheduledRow, amount: string) {
  const date = today();
  const notes = scheduled.description;

  switch (scheduled.type) {
    case "income":
      return recordIncome(tx, userId, {
        accountId: scheduled.accountId!,
        amount,
        date,
        source: scheduled.description,
      });
    case "expense":
      return recordExpense(tx, userId, {
        accountId: scheduled.accountId!,
        categoryId: scheduled.categoryId!,
        amount,
        date,
        source: scheduled.description,
      });
    case "allocation":
      return recordAllocation(tx, userId, {
        categoryId: scheduled.categoryId!,
        amount,
        date,
        notes,
      });
    case "debt_payment":
      return recordDebtPayment(tx, userId, {
        fromAccountId: scheduled.accountId!,
        debtAccountId: scheduled.relatedAccountId!,
        amount,
        date,
        notes,
      });
    case "transfer":
      return recordTransfer(tx, userId, {
        fromAccountId: scheduled.accountId!,
        toAccountId: scheduled.relatedAccountId!,
        amount,
        date,
        notes,
      });
    case "category_reallocation":
      return recordCategoryReallocation(tx, userId, {
        fromCategoryId: scheduled.categoryId!,
        toCategoryId: scheduled.relatedCategoryId!,
        amount,
        date,
        notes,
      });
  }
}
