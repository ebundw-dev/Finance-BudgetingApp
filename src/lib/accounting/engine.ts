import { and, eq, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { accounts, categories, debts, transactionHistory, transactions, transactionSplits } from "@/db/schema";
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

// Phase 12 audit trail. A full row snapshot (plus splits, for a split
// expense) rather than a hand-picked list of "the fields that matter" --
// see transaction_history's schema comment for why. Not exported: only
// updateExpense/updateSplitExpense/deleteTransaction call this, and they
// all live in this file already.
type TransactionRow = typeof transactions.$inferSelect;

async function snapshotTransactionRow(
  tx: Tx,
  txnRow: TransactionRow
): Promise<TransactionRow & { splits?: { categoryId: string; amount: string }[] }> {
  if (txnRow.type !== "expense" || txnRow.categoryId !== null) {
    return txnRow;
  }
  const splits = await tx
    .select({ categoryId: transactionSplits.categoryId, amount: transactionSplits.amount })
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, txnRow.id));
  return { ...txnRow, splits };
}

async function recordTransactionHistory(
  tx: Tx,
  userId: string,
  transactionId: string,
  action: "updated" | "deleted",
  oldValues: unknown,
  newValues: unknown
): Promise<void> {
  await tx.insert(transactionHistory).values({
    transactionId,
    userId,
    action,
    oldValues: oldValues as object,
    newValues: newValues as object | null,
  });
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

// Locks an arbitrary set of rows of the same table in a stable order (by
// id) for the same deadlock-avoidance reason as lockTwo above, generalized
// to N rows for bulk allocation.
async function lockMany<T extends { id: string }>(
  ids: string[],
  lockOne: (id: string) => Promise<T>
): Promise<T[]> {
  const sortedIds = [...new Set(ids)].sort();
  const results: T[] = [];
  for (const id of sortedIds) {
    results.push(await lockOne(id));
  }
  return results;
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

export interface SplitItem {
  categoryId: string;
  amount: string;
}

function validateSplits(splits: SplitItem[], totalAmount: string): void {
  if (splits.length < 2) {
    throw new ValidationError("A split expense needs at least two categories.");
  }

  const categoryIds = splits.map((s) => s.categoryId);
  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new ValidationError("Cannot split the same category twice in one transaction.");
  }

  for (const split of splits) {
    assertPositiveAmount(split.amount);
  }

  const splitTotal = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  if (Math.abs(splitTotal - Number(totalAmount)) > 0.001) {
    throw new ValidationError(
      `Splits total ${splitTotal.toFixed(2)} but the transaction amount is ${Number(totalAmount).toFixed(2)}.`
    );
  }
}

// Looks up the credit-card debt reserve category for an account, the same
// way the unsplit branch of recordExpense does -- every split of one
// transaction shares this one account, so they all share the same reserve
// category too.
async function findReserveCategoryId(
  tx: Tx,
  userId: string,
  account: typeof accounts.$inferSelect
): Promise<string | undefined> {
  if (account.type !== "credit_card") {
    return undefined;
  }
  const [debt] = await tx
    .select()
    .from(debts)
    .where(and(eq(debts.accountId, account.id), eq(debts.userId, userId)));
  if (!debt) {
    throw new NotFoundError(`Account ${account.id} is not a tracked debt; cannot charge it.`);
  }
  return debt.categoryId;
}

export interface RecordSplitExpenseParams {
  accountId: string;
  splits: SplitItem[];
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

// Same accounting as recordExpense (including the credit-card reserve-
// category mechanic), just fanned out across categories instead of applied
// once. The parent transactions row keeps the total amount and account, but
// categoryId is null -- the per-category breakdown lives in
// transaction_splits, one row per split.
export async function recordSplitExpense(
  tx: Tx,
  userId: string,
  params: RecordSplitExpenseParams
) {
  assertPositiveAmount(params.amount);
  validateSplits(params.splits, params.amount);

  const account = await lockAccount(tx, userId, params.accountId);
  const isCreditCard = account.type === "credit_card";
  if (!account.isCashAccount && !isCreditCard) {
    throw new ValidationError(
      "Expenses must be charged to a cash account or a credit card."
    );
  }

  const reserveCategoryId = await findReserveCategoryId(tx, userId, account);

  const idsToLock = reserveCategoryId
    ? [...params.splits.map((s) => s.categoryId), reserveCategoryId]
    : params.splits.map((s) => s.categoryId);
  const lockedCategories = await lockMany(idsToLock, (id) => lockCategory(tx, userId, id));
  const categoryById = new Map(lockedCategories.map((c) => [c.id, c]));

  for (const split of params.splits) {
    const category = categoryById.get(split.categoryId)!;
    if (Number(category.allocatedBalance) < Number(split.amount)) {
      throw new InsufficientCategoryBalanceError(
        `Category "${category.name}" has ${category.allocatedBalance} available, cannot spend ${split.amount}.`
      );
    }
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "expense",
      accountId: account.id,
      categoryId: null,
      relatedCategoryId: reserveCategoryId,
      amount: params.amount,
      date: params.date,
      source: params.source,
      notes: params.notes,
    })
    .returning();

  for (const split of params.splits) {
    await tx.insert(transactionSplits).values({
      transactionId: txn.id,
      categoryId: split.categoryId,
      amount: split.amount,
    });

    await tx
      .update(categories)
      .set({
        allocatedBalance: sql`${categories.allocatedBalance} - ${split.amount}`,
      })
      .where(eq(categories.id, split.categoryId));

    if (reserveCategoryId) {
      await tx
        .update(categories)
        .set({
          allocatedBalance: sql`${categories.allocatedBalance} + ${split.amount}`,
        })
        .where(eq(categories.id, reserveCategoryId));
    }
  }

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

export interface UpdateSplitExpenseParams {
  transactionId: string;
  splits: SplitItem[];
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

// Redistributes an existing split expense's categories/amounts (add,
// remove, or resize rows) and/or its total amount, date, or notes. Account
// and type are immutable here -- only the category breakdown and the
// metadata a receipt correction would touch. Reverses the old splits'
// effects and applies the new ones as one net delta per category, so no
// intermediate write can trip the allocated_balance >= 0 check even when a
// category is both in the old and new split sets.
export async function updateSplitExpense(
  tx: Tx,
  userId: string,
  params: UpdateSplitExpenseParams
) {
  assertPositiveAmount(params.amount);
  validateSplits(params.splits, params.amount);

  const [txnRow] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .for("update");
  if (!txnRow) {
    throw new NotFoundError(`Transaction ${params.transactionId} not found.`);
  }
  if (txnRow.type !== "expense" || txnRow.categoryId !== null || !txnRow.accountId) {
    throw new ValidationError("Only a split expense can be edited this way.");
  }

  const existingSplits = await tx
    .select()
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, txnRow.id));

  const account = await lockAccount(tx, userId, txnRow.accountId);
  const isCreditCard = account.type === "credit_card";
  const reserveCategoryId = await findReserveCategoryId(tx, userId, account);

  const allCategoryIds = new Set([
    ...existingSplits.map((s) => s.categoryId),
    ...params.splits.map((s) => s.categoryId),
    ...(reserveCategoryId ? [reserveCategoryId] : []),
  ]);
  const lockedCategories = await lockMany([...allCategoryIds], (id) => lockCategory(tx, userId, id));
  const categoryById = new Map(lockedCategories.map((c) => [c.id, c]));

  const balanceDelta = new Map<string, number>();
  const addDelta = (id: string, delta: number) => {
    balanceDelta.set(id, (balanceDelta.get(id) ?? 0) + delta);
  };

  for (const split of existingSplits) {
    addDelta(split.categoryId, Number(split.amount));
    if (reserveCategoryId) {
      addDelta(reserveCategoryId, -Number(split.amount));
    }
  }
  for (const split of params.splits) {
    addDelta(split.categoryId, -Number(split.amount));
    if (reserveCategoryId) {
      addDelta(reserveCategoryId, Number(split.amount));
    }
  }

  for (const [categoryId, delta] of balanceDelta.entries()) {
    if (delta < 0) {
      const category = categoryById.get(categoryId)!;
      if (Number(category.allocatedBalance) + delta < -0.001) {
        throw new InsufficientCategoryBalanceError(
          `Category "${category.name}" has ${category.allocatedBalance} available, cannot apply a net change of ${delta.toFixed(2)}.`
        );
      }
    }
  }

  for (const [categoryId, delta] of balanceDelta.entries()) {
    if (delta === 0) continue;
    await tx
      .update(categories)
      .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${delta.toFixed(2)}` })
      .where(eq(categories.id, categoryId));
  }

  await tx.delete(transactionSplits).where(eq(transactionSplits.transactionId, txnRow.id));
  for (const split of params.splits) {
    await tx.insert(transactionSplits).values({
      transactionId: txnRow.id,
      categoryId: split.categoryId,
      amount: split.amount,
    });
  }

  const amountDelta = Number(params.amount) - Number(txnRow.amount);
  if (amountDelta !== 0) {
    await tx
      .update(accounts)
      .set({
        currentBalance: isCreditCard
          ? sql`${accounts.currentBalance} + ${amountDelta.toFixed(2)}`
          : sql`${accounts.currentBalance} - ${amountDelta.toFixed(2)}`,
      })
      .where(eq(accounts.id, account.id));
  }

  const [updated] = await tx
    .update(transactions)
    .set({
      amount: params.amount,
      relatedCategoryId: reserveCategoryId,
      date: params.date,
      source: params.source,
      notes: params.notes,
    })
    .where(eq(transactions.id, txnRow.id))
    .returning();

  await recordTransactionHistory(
    tx,
    userId,
    txnRow.id,
    "updated",
    { ...txnRow, splits: existingSplits },
    { ...updated, splits: params.splits }
  );

  return updated;
}

export interface UpdateExpenseParams {
  transactionId: string;
  categoryId: string;
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

// Same "reverse old, apply new, net into one delta per category" pattern
// as updateSplitExpense just above, specialized to a single (non-split)
// category. Account and type are immutable here too, same rationale:
// this is a receipt correction (wrong category/amount/date), not a way
// to move an expense to a different account.
export async function updateExpense(
  tx: Tx,
  userId: string,
  params: UpdateExpenseParams
) {
  assertPositiveAmount(params.amount);

  const [txnRow] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.transactionId), eq(transactions.userId, userId)))
    .for("update");
  if (!txnRow) {
    throw new NotFoundError(`Transaction ${params.transactionId} not found.`);
  }
  if (txnRow.type !== "expense" || txnRow.categoryId === null || !txnRow.accountId) {
    throw new ValidationError("Only a plain (non-split) expense can be edited this way.");
  }

  const account = await lockAccount(tx, userId, txnRow.accountId);
  const isCreditCard = account.type === "credit_card";
  const reserveCategoryId = await findReserveCategoryId(tx, userId, account);

  const allCategoryIds = new Set([
    txnRow.categoryId,
    params.categoryId,
    ...(reserveCategoryId ? [reserveCategoryId] : []),
  ]);
  const lockedCategories = await lockMany([...allCategoryIds], (id) => lockCategory(tx, userId, id));
  const categoryById = new Map(lockedCategories.map((c) => [c.id, c]));

  const balanceDelta = new Map<string, number>();
  const addDelta = (id: string, delta: number) => {
    balanceDelta.set(id, (balanceDelta.get(id) ?? 0) + delta);
  };

  // Reverse the old effect, then apply the new one -- net per category so
  // an unchanged category (or the reserve category, which is touched by
  // both the old and new effect every time) never sees an intermediate
  // negative write even if it would net to a small or zero change.
  addDelta(txnRow.categoryId, Number(txnRow.amount));
  if (reserveCategoryId) addDelta(reserveCategoryId, -Number(txnRow.amount));
  addDelta(params.categoryId, -Number(params.amount));
  if (reserveCategoryId) addDelta(reserveCategoryId, Number(params.amount));

  for (const [categoryId, delta] of balanceDelta.entries()) {
    if (delta < 0) {
      const category = categoryById.get(categoryId)!;
      if (Number(category.allocatedBalance) + delta < -0.001) {
        throw new InsufficientCategoryBalanceError(
          `Category "${category.name}" has ${category.allocatedBalance} available, cannot apply a net change of ${delta.toFixed(2)}.`
        );
      }
    }
  }

  for (const [categoryId, delta] of balanceDelta.entries()) {
    if (delta === 0) continue;
    await tx
      .update(categories)
      .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${delta.toFixed(2)}` })
      .where(eq(categories.id, categoryId));
  }

  const amountDelta = Number(params.amount) - Number(txnRow.amount);
  if (amountDelta !== 0) {
    await tx
      .update(accounts)
      .set({
        currentBalance: isCreditCard
          ? sql`${accounts.currentBalance} + ${amountDelta.toFixed(2)}`
          : sql`${accounts.currentBalance} - ${amountDelta.toFixed(2)}`,
      })
      .where(eq(accounts.id, account.id));
  }

  const [updated] = await tx
    .update(transactions)
    .set({
      categoryId: params.categoryId,
      amount: params.amount,
      relatedCategoryId: reserveCategoryId,
      date: params.date,
      source: params.source,
      notes: params.notes,
    })
    .where(eq(transactions.id, txnRow.id))
    .returning();

  await recordTransactionHistory(tx, userId, txnRow.id, "updated", txnRow, updated);

  return updated;
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

export interface BulkAllocationItem {
  categoryId: string;
  amount: string;
}

// Distributes a lump sum across several categories in one atomic
// operation, checking the combined total against Unallocated Cash rather
// than checking each row independently -- used by the allocation screen's
// multi-category form, Auto-Allocate (rule-set percentages, see
// allocationRules.ts), and Quick Payout Allocation (priority-tagged
// categories). Writes one 'allocation' ledger row per category, same as
// calling recordAllocation once per item would, just atomically.
export async function recordBulkAllocation(
  tx: Tx,
  userId: string,
  items: BulkAllocationItem[],
  params: { date: string; notes?: string }
) {
  const positiveItems = items.filter((item) => Number(item.amount) > 0);
  if (positiveItems.length === 0) {
    throw new ValidationError("At least one allocation amount must be greater than zero.");
  }

  const ids = positiveItems.map((item) => item.categoryId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("Cannot allocate to the same category twice in one batch.");
  }

  const lockedCategories = await lockMany(ids, (id) => lockCategory(tx, userId, id));
  const byId = new Map(lockedCategories.map((category) => [category.id, category]));

  const totalRequested = positiveItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const unallocated = await getUnallocatedCash(tx, userId);
  if (totalRequested > unallocated) {
    throw new InsufficientUnallocatedCashError(
      `Cannot allocate ${totalRequested.toFixed(2)}; only ${unallocated.toFixed(2)} unallocated.`
    );
  }

  const created = [];
  for (const item of positiveItems) {
    const category = byId.get(item.categoryId)!;

    const [txn] = await tx
      .insert(transactions)
      .values({
        userId,
        type: "allocation",
        categoryId: category.id,
        amount: item.amount,
        date: params.date,
        notes: params.notes,
      })
      .returning();
    created.push(txn);

    await tx
      .update(categories)
      .set({
        allocatedBalance: sql`${categories.allocatedBalance} + ${item.amount}`,
      })
      .where(eq(categories.id, category.id));
  }

  return created;
}

export interface RecordReconciliationParams {
  accountId: string;
  statementBalance: string;
  notes?: string;
}

// Corrects drift between Ledger's computed cash-account balance and a
// real bank-statement balance the user just typed in. Scoped to cash
// accounts only (isCashAccount) -- a credit card's balance is governed by
// its debt reserve category mechanic (see CLAUDE.md), and correctly
// reconciling that would mean also adjusting the reserve category, which
// this feature doesn't attempt; investment/other non-cash accounts have
// no "statement balance" concept Ledger tracks cash against at all.
//
// Deliberately touches only the account's currentBalance, no category --
// economically identical to an unattributed, signed income/expense, so
// Unallocated Cash absorbs the entire delta (up for a surplus, down for
// a shortfall), same as CLAUDE.md's Income row does for a surplus. A
// zero delta ("confirms a match") writes no transaction row at all --
// there's nothing to correct or audit, just the last-reconciled
// bookkeeping fields.
export async function recordReconciliation(tx: Tx, userId: string, params: RecordReconciliationParams) {
  if (Number.isNaN(Number(params.statementBalance))) {
    throw new ValidationError("Statement balance must be a number.");
  }

  const account = await lockAccount(tx, userId, params.accountId);
  if (!account.isCashAccount) {
    throw new ValidationError("Only cash accounts can be reconciled.");
  }

  const delta = Number(params.statementBalance) - Number(account.currentBalance);
  const today = new Date().toISOString().slice(0, 10);

  if (delta === 0) {
    await tx
      .update(accounts)
      .set({ lastReconciledAt: new Date(), lastReconciledBalance: params.statementBalance })
      .where(eq(accounts.id, account.id));
    return { matched: true as const, delta: "0.00" };
  }

  if (delta < 0) {
    const unallocated = await getUnallocatedCash(tx, userId);
    if (unallocated + delta < -0.001) {
      throw new InsufficientUnallocatedCashError(
        `This shortfall (${Math.abs(delta).toFixed(2)}) would take Unallocated Cash below zero -- only ${unallocated.toFixed(2)} is unallocated. Reallocate some categories back to Unallocated Cash first.`
      );
    }
  }

  const [txn] = await tx
    .insert(transactions)
    .values({
      userId,
      type: "reconciliation",
      accountId: account.id,
      amount: Math.abs(delta).toFixed(2),
      reconciliationDelta: delta.toFixed(2),
      date: today,
      notes: params.notes,
    })
    .returning();

  await tx
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + ${delta.toFixed(2)}`,
      lastReconciledAt: new Date(),
      lastReconciledBalance: params.statementBalance,
    })
    .where(eq(accounts.id, account.id));

  return { matched: false as const, delta: delta.toFixed(2), transaction: txn };
}

// Reverses whatever recordX function originally created this row --
// mirror image of each one, dispatched by the row's own `type`. No
// dedicated web UI calls this today (there is no delete-transaction
// action anywhere in the codebase); it exists to back the mobile API's
// DELETE /api/transactions/[id]. Every branch nets to a "give back what
// this transaction took, take back what it gave" write, validated
// against the same allocated_balance >= 0 rule as every other mutation
// -- e.g. deleting an old category_reallocation or allocation can
// legitimately fail with InsufficientCategoryBalanceError if the
// category it credited has since been spent down below what reversing
// this row would subtract.
export async function deleteTransaction(tx: Tx, userId: string, transactionId: string) {
  const [txnRow] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .for("update");
  if (!txnRow) {
    throw new NotFoundError(`Transaction ${transactionId} not found.`);
  }

  // Captured before any reversal writes below touch splits/categories/
  // accounts, so the audit snapshot reflects exactly what existed at the
  // moment of deletion.
  const deletedSnapshot = await snapshotTransactionRow(tx, txnRow);

  switch (txnRow.type) {
    case "expense": {
      if (!txnRow.accountId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing its account.`);
      }
      const account = await lockAccount(tx, userId, txnRow.accountId);
      const isCreditCard = account.type === "credit_card";
      const reserveCategoryId = txnRow.relatedCategoryId ?? undefined;

      if (txnRow.categoryId === null) {
        // Split expense -- reverse every transaction_splits row the same
        // way updateSplitExpense reverses "existing splits".
        const splits = await tx
          .select()
          .from(transactionSplits)
          .where(eq(transactionSplits.transactionId, txnRow.id));

        const idsToLock = reserveCategoryId
          ? [...splits.map((s) => s.categoryId), reserveCategoryId]
          : splits.map((s) => s.categoryId);
        const lockedCategories = await lockMany(idsToLock, (id) => lockCategory(tx, userId, id));
        const categoryById = new Map(lockedCategories.map((c) => [c.id, c]));

        const totalSplitAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
        if (reserveCategoryId) {
          const reserveCategory = categoryById.get(reserveCategoryId)!;
          if (Number(reserveCategory.allocatedBalance) - totalSplitAmount < -0.001) {
            throw new InsufficientCategoryBalanceError(
              `Category "${reserveCategory.name}" has ${reserveCategory.allocatedBalance} available, cannot remove ${totalSplitAmount.toFixed(2)} by deleting this transaction.`
            );
          }
        }

        for (const split of splits) {
          await tx
            .update(categories)
            .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${split.amount}` })
            .where(eq(categories.id, split.categoryId));
        }
        if (reserveCategoryId) {
          await tx
            .update(categories)
            .set({ allocatedBalance: sql`${categories.allocatedBalance} - ${totalSplitAmount.toFixed(2)}` })
            .where(eq(categories.id, reserveCategoryId));
        }

        await tx.delete(transactionSplits).where(eq(transactionSplits.transactionId, txnRow.id));
      } else {
        // Plain expense.
        const idsToLock = reserveCategoryId ? [txnRow.categoryId, reserveCategoryId] : [txnRow.categoryId];
        const lockedCategories = await lockMany(idsToLock, (id) => lockCategory(tx, userId, id));
        const categoryById = new Map(lockedCategories.map((c) => [c.id, c]));

        if (reserveCategoryId) {
          const reserveCategory = categoryById.get(reserveCategoryId)!;
          if (Number(reserveCategory.allocatedBalance) - Number(txnRow.amount) < -0.001) {
            throw new InsufficientCategoryBalanceError(
              `Category "${reserveCategory.name}" has ${reserveCategory.allocatedBalance} available, cannot remove ${txnRow.amount} by deleting this transaction.`
            );
          }
        }

        await tx
          .update(categories)
          .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${txnRow.amount}` })
          .where(eq(categories.id, txnRow.categoryId));
        if (reserveCategoryId) {
          await tx
            .update(categories)
            .set({ allocatedBalance: sql`${categories.allocatedBalance} - ${txnRow.amount}` })
            .where(eq(categories.id, reserveCategoryId));
        }
      }

      await tx
        .update(accounts)
        .set({
          currentBalance: isCreditCard
            ? sql`${accounts.currentBalance} - ${txnRow.amount}`
            : sql`${accounts.currentBalance} + ${txnRow.amount}`,
        })
        .where(eq(accounts.id, account.id));
      break;
    }

    case "income": {
      if (!txnRow.accountId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing its account.`);
      }
      await lockAccount(tx, userId, txnRow.accountId);
      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} - ${txnRow.amount}` })
        .where(eq(accounts.id, txnRow.accountId));
      break;
    }

    case "transfer": {
      if (!txnRow.accountId || !txnRow.relatedAccountId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing an account.`);
      }
      const [fromAccount, toAccount] = await lockTwo(txnRow.accountId, txnRow.relatedAccountId, (id) =>
        lockAccount(tx, userId, id)
      );
      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} + ${txnRow.amount}` })
        .where(eq(accounts.id, fromAccount.id));
      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} - ${txnRow.amount}` })
        .where(eq(accounts.id, toAccount.id));
      break;
    }

    case "debt_payment": {
      if (!txnRow.accountId || !txnRow.relatedAccountId || !txnRow.categoryId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing an account or category.`);
      }
      const [fromAccount, debtAccount] = await lockTwo(txnRow.accountId, txnRow.relatedAccountId, (id) =>
        lockAccount(tx, userId, id)
      );
      await lockCategory(tx, userId, txnRow.categoryId);
      await tx
        .update(categories)
        .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${txnRow.amount}` })
        .where(eq(categories.id, txnRow.categoryId));
      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} + ${txnRow.amount}` })
        .where(eq(accounts.id, fromAccount.id));
      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} + ${txnRow.amount}` })
        .where(eq(accounts.id, debtAccount.id));
      break;
    }

    case "category_reallocation": {
      if (!txnRow.categoryId || !txnRow.relatedCategoryId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing a category.`);
      }
      const [fromCategory, toCategory] = await lockTwo(txnRow.categoryId, txnRow.relatedCategoryId, (id) =>
        lockCategory(tx, userId, id)
      );
      if (Number(toCategory.allocatedBalance) - Number(txnRow.amount) < -0.001) {
        throw new InsufficientCategoryBalanceError(
          `Category "${toCategory.name}" has ${toCategory.allocatedBalance} available, cannot remove ${txnRow.amount} by deleting this transaction.`
        );
      }
      await tx
        .update(categories)
        .set({ allocatedBalance: sql`${categories.allocatedBalance} + ${txnRow.amount}` })
        .where(eq(categories.id, fromCategory.id));
      await tx
        .update(categories)
        .set({ allocatedBalance: sql`${categories.allocatedBalance} - ${txnRow.amount}` })
        .where(eq(categories.id, toCategory.id));
      break;
    }

    case "allocation": {
      if (!txnRow.categoryId) {
        throw new NotFoundError(`Transaction ${transactionId} is missing a category.`);
      }
      const category = await lockCategory(tx, userId, txnRow.categoryId);
      if (Number(category.allocatedBalance) - Number(txnRow.amount) < -0.001) {
        throw new InsufficientCategoryBalanceError(
          `Category "${category.name}" has ${category.allocatedBalance} available, cannot remove ${txnRow.amount} by deleting this transaction.`
        );
      }
      await tx
        .update(categories)
        .set({ allocatedBalance: sql`${categories.allocatedBalance} - ${txnRow.amount}` })
        .where(eq(categories.id, category.id));
      break;
    }

    case "reconciliation": {
      if (!txnRow.accountId || txnRow.reconciliationDelta === null) {
        throw new NotFoundError(`Transaction ${transactionId} is missing its account or delta.`);
      }
      await lockAccount(tx, userId, txnRow.accountId);
      const delta = Number(txnRow.reconciliationDelta);

      // A surplus reconciliation raised Unallocated Cash when it posted;
      // reversing it lowers Cash again, which can legitimately fail if
      // some of that surplus has since been allocated into categories.
      // A shortfall reconciliation only ever gets safer to reverse
      // (reversing it raises Cash back), so no guard is needed there.
      if (delta > 0) {
        const unallocated = await getUnallocatedCash(tx, userId);
        if (unallocated - delta < -0.001) {
          throw new InsufficientUnallocatedCashError(
            `Reversing this reconciliation would take Unallocated Cash below zero -- only ${unallocated.toFixed(2)} is unallocated.`
          );
        }
      }

      await tx
        .update(accounts)
        .set({ currentBalance: sql`${accounts.currentBalance} - ${delta.toFixed(2)}` })
        .where(eq(accounts.id, txnRow.accountId));
      break;
    }
  }

  await recordTransactionHistory(tx, userId, txnRow.id, "deleted", deletedSnapshot, null);

  await tx.delete(transactions).where(eq(transactions.id, txnRow.id));
  return { id: txnRow.id, deleted: true };
}
