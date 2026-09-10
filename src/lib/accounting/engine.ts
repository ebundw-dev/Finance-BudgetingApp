import { and, eq, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { accounts, categories, debts, transactions } from "@/db/schema";
import {
  InsufficientCategoryBalanceError,
  InsufficientUnallocatedCashError,
  NotFoundError,
  ValidationError,
} from "./errors";

// Typed against the common NeonDatabase base rather than the
// db.transaction() callback's NeonTransaction type: NeonTransaction adds
// members (rollback, nested transaction) that a plain NeonDatabase instance
// doesn't have, so a NeonTransaction argument is still assignable here, but
// the reverse wouldn't be -- and the test harness passes a plain
// NeonDatabase bound to a manually-opened transaction (see testing.ts).
export type Tx = NeonDatabase<typeof schema>;

function assertPositiveAmount(amount: string | number): void {
  if (Number(amount) <= 0) {
    throw new ValidationError("Amount must be greater than zero.");
  }
}

async function lockAccount(tx: Tx, userId: string, accountId: string) {
  const [account] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .for("update");
  if (!account) {
    throw new NotFoundError(`Account ${accountId} not found.`);
  }
  return account;
}

async function lockCategory(tx: Tx, userId: string, categoryId: string) {
  const [category] = await tx
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .for("update");
  if (!category) {
    throw new NotFoundError(`Category ${categoryId} not found.`);
  }
  return category;
}

// Locks two rows of the same table in a stable order (by id) so two
// operations racing over the same pair of rows in opposite directions
// (e.g. concurrent transfers A->B and B->A) can't deadlock each other.
async function lockTwo<T>(
  idA: string,
  idB: string,
  lockOne: (id: string) => Promise<T>
): Promise<[T, T]> {
  const [firstId, secondId] = [idA, idB].sort();
  const first = await lockOne(firstId);
  const second = await lockOne(secondId);
  return firstId === idA ? [first, second] : [second, first];
}

// Reads (unlocked) the current Unallocated Cash for a user, for pre-flight
// validation and friendly error messages. This is a snapshot, not a lock:
// two concurrent allocations against different categories could both read
// a value that passes this check and together over-allocate. Correctness
// in that case is guaranteed by the deferred DB constraint trigger
// (assert_unallocated_cash_non_negative in drizzle/0001_unallocated_cash_guard.sql),
// which evaluates the same aggregate at COMMIT and rolls back whichever
// transaction would leave it negative.
async function getUnallocatedCash(tx: Tx, userId: string): Promise<number> {
  const [cashRow] = await tx
    .select({
      totalCash: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isCashAccount, true)));

  const [categoryRow] = await tx
    .select({
      totalAllocated: sql<string>`coalesce(sum(${categories.allocatedBalance}), 0)`,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  return Number(cashRow.totalCash) - Number(categoryRow.totalAllocated);
}

export interface RecordIncomeParams {
  accountId: string;
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

export async function recordIncome(
  tx: Tx,
  userId: string,
  params: RecordIncomeParams
) {
  assertPositiveAmount(params.amount);
  const account = await lockAccount(tx, userId, params.accountId);
  if (!account.isCashAccount) {
    throw new ValidationError("Income must be deposited into a cash account.");
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "income",
      accountId: account.id,
      amount: params.amount,
      date: params.date,
      source: params.source,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(accounts)
    .set({ currentBalance: sql`${accounts.currentBalance} + ${params.amount}` })
    .where(eq(accounts.id, account.id));

  return txn;
}

export interface RecordAllocationParams {
  categoryId: string;
  amount: string;
  date: string;
  notes?: string;
}

export async function recordAllocation(
  tx: Tx,
  userId: string,
  params: RecordAllocationParams
) {
  assertPositiveAmount(params.amount);
  const category = await lockCategory(tx, userId, params.categoryId);

  const unallocated = await getUnallocatedCash(tx, userId);
  if (Number(params.amount) > unallocated) {
    throw new InsufficientUnallocatedCashError(
      `Cannot allocate ${params.amount}; only ${unallocated} unallocated.`
    );
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "allocation",
      categoryId: category.id,
      amount: params.amount,
      date: params.date,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(categories)
    .set({
      allocatedBalance: sql`${categories.allocatedBalance} + ${params.amount}`,
    })
    .where(eq(categories.id, category.id));

  return txn;
}

export interface RecordExpenseParams {
  accountId: string;
  categoryId: string;
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

export async function recordExpense(
  tx: Tx,
  userId: string,
  params: RecordExpenseParams
) {
  assertPositiveAmount(params.amount);
  const account = await lockAccount(tx, userId, params.accountId);

  const isCreditCard = account.type === "credit_card";
  if (!account.isCashAccount && !isCreditCard) {
    throw new ValidationError(
      "Expenses must be charged to a cash account or a credit card."
    );
  }

  // A credit card purchase must not move Unallocated Cash. Sum(categories)
  // has to stay constant, so the amount debited from the spending category
  // is simultaneously credited to the card's own reserve category (the one
  // linked via debts.category_id, e.g. "Credit Card 1") -- it's cash that's
  // now earmarked to pay this purchase off. Paying the bill later draws
  // that reserve back down; see recordDebtPayment. Locked in a stable order
  // with the spending category to avoid deadlocking a concurrent operation
  // that locks the same two categories in the opposite order.
  let reserveCategoryId: string | undefined;
  if (isCreditCard) {
    const [debt] = await tx
      .select()
      .from(debts)
      .where(and(eq(debts.accountId, account.id), eq(debts.userId, userId)));
    if (!debt) {
      throw new NotFoundError(
        `Account ${account.id} is not a tracked debt; cannot charge it.`
      );
    }
    reserveCategoryId = debt.categoryId;
  }

  const [category, reserveCategory] = reserveCategoryId
    ? await lockTwo(params.categoryId, reserveCategoryId, (id) =>
        lockCategory(tx, userId, id)
      )
    : [await lockCategory(tx, userId, params.categoryId), undefined];

  if (Number(category.allocatedBalance) < Number(params.amount)) {
    throw new InsufficientCategoryBalanceError(
      `Category "${category.name}" has ${category.allocatedBalance} available, cannot spend ${params.amount}.`
    );
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "expense",
      accountId: account.id,
      categoryId: category.id,
      relatedCategoryId: reserveCategory?.id,
      amount: params.amount,
      date: params.date,
      source: params.source,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(categories)
    .set({
      allocatedBalance: sql`${categories.allocatedBalance} - ${params.amount}`,
    })
    .where(eq(categories.id, category.id));

  if (reserveCategory) {
    await tx
      .update(categories)
      .set({
        allocatedBalance: sql`${categories.allocatedBalance} + ${params.amount}`,
      })
      .where(eq(categories.id, reserveCategory.id));
  }

  // Credit card purchase: no cash leaves the system yet -- only the debt
  // owed increases. A cash account expense is the opposite: cash leaves
  // immediately, no debt is created.
  await tx
    .update(accounts)
    .set({
      currentBalance: isCreditCard
        ? sql`${accounts.currentBalance} + ${params.amount}`
        : sql`${accounts.currentBalance} - ${params.amount}`,
    })
    .where(eq(accounts.id, account.id));

  return txn;
}

export interface RecordDebtPaymentParams {
  fromAccountId: string;
  debtAccountId: string;
  amount: string;
  date: string;
  notes?: string;
}

export async function recordDebtPayment(
  tx: Tx,
  userId: string,
  params: RecordDebtPaymentParams
) {
  assertPositiveAmount(params.amount);
  if (params.fromAccountId === params.debtAccountId) {
    throw new ValidationError("A debt cannot be paid from itself.");
  }

  const [fromAccount, debtAccount] = await lockTwo(
    params.fromAccountId,
    params.debtAccountId,
    (id) => lockAccount(tx, userId, id)
  );

  if (!fromAccount.isCashAccount) {
    throw new ValidationError("Debt payments must be paid from a cash account.");
  }

  const [debt] = await tx
    .select()
    .from(debts)
    .where(and(eq(debts.accountId, debtAccount.id), eq(debts.userId, userId)));
  if (!debt) {
    throw new NotFoundError(`Account ${debtAccount.id} is not a tracked debt.`);
  }

  // Mirror image of the credit-card branch of recordExpense: draws down the
  // debt's reserve category by the same amount cash drops, so Sum(categories)
  // and Total Cash fall together and Unallocated Cash never moves. This is
  // also why paying a bill is never "spending": the spending category (if
  // any) was already debited when the purchase happened, not now.
  const reserveCategory = await lockCategory(tx, userId, debt.categoryId);
  if (Number(reserveCategory.allocatedBalance) < Number(params.amount)) {
    throw new InsufficientCategoryBalanceError(
      `Only ${reserveCategory.allocatedBalance} is reserved to pay down this debt, cannot pay ${params.amount}.`
    );
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "debt_payment",
      accountId: fromAccount.id,
      relatedAccountId: debtAccount.id,
      categoryId: reserveCategory.id,
      amount: params.amount,
      date: params.date,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(categories)
    .set({
      allocatedBalance: sql`${categories.allocatedBalance} - ${params.amount}`,
    })
    .where(eq(categories.id, reserveCategory.id));

  await tx
    .update(accounts)
    .set({ currentBalance: sql`${accounts.currentBalance} - ${params.amount}` })
    .where(eq(accounts.id, fromAccount.id));

  await tx
    .update(accounts)
    .set({ currentBalance: sql`${accounts.currentBalance} - ${params.amount}` })
    .where(eq(accounts.id, debtAccount.id));

  return txn;
}

export interface RecordTransferParams {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: string;
  notes?: string;
}

export async function recordTransfer(
  tx: Tx,
  userId: string,
  params: RecordTransferParams
) {
  assertPositiveAmount(params.amount);
  if (params.fromAccountId === params.toAccountId) {
    throw new ValidationError("Cannot transfer an account to itself.");
  }

  const [fromAccount, toAccount] = await lockTwo(
    params.fromAccountId,
    params.toAccountId,
    (id) => lockAccount(tx, userId, id)
  );

  if (!fromAccount.isCashAccount || !toAccount.isCashAccount) {
    throw new ValidationError("Transfers must be between two cash accounts.");
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "transfer",
      accountId: fromAccount.id,
      relatedAccountId: toAccount.id,
      amount: params.amount,
      date: params.date,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(accounts)
    .set({ currentBalance: sql`${accounts.currentBalance} - ${params.amount}` })
    .where(eq(accounts.id, fromAccount.id));

  await tx
    .update(accounts)
    .set({ currentBalance: sql`${accounts.currentBalance} + ${params.amount}` })
    .where(eq(accounts.id, toAccount.id));

  return txn;
}

export interface RecordCategoryReallocationParams {
  fromCategoryId: string;
  toCategoryId: string;
  amount: string;
  date: string;
  notes?: string;
}

export async function recordCategoryReallocation(
  tx: Tx,
  userId: string,
  params: RecordCategoryReallocationParams
) {
  assertPositiveAmount(params.amount);
  if (params.fromCategoryId === params.toCategoryId) {
    throw new ValidationError("Cannot reallocate a category to itself.");
  }

  const [fromCategory, toCategory] = await lockTwo(
    params.fromCategoryId,
    params.toCategoryId,
    (id) => lockCategory(tx, userId, id)
  );

  if (Number(fromCategory.allocatedBalance) < Number(params.amount)) {
    throw new InsufficientCategoryBalanceError(
      `Category "${fromCategory.name}" has ${fromCategory.allocatedBalance} available, cannot move ${params.amount}.`
    );
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "category_reallocation",
      categoryId: fromCategory.id,
      relatedCategoryId: toCategory.id,
      amount: params.amount,
      date: params.date,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(categories)
    .set({
      allocatedBalance: sql`${categories.allocatedBalance} - ${params.amount}`,
    })
    .where(eq(categories.id, fromCategory.id));

  await tx
    .update(categories)
    .set({
      allocatedBalance: sql`${categories.allocatedBalance} + ${params.amount}`,
    })
    .where(eq(categories.id, toCategory.id));

  return txn;
}
