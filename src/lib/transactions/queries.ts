import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, categories, transactionSplits, transactions } from "@/db/schema";

const relatedAccounts = alias(accounts, "related_accounts");
const relatedCategories = alias(categories, "related_categories");

export interface TransactionSplitRow {
  categoryId: string;
  categoryName: string;
  amount: string;
}

export interface TransactionRow {
  id: string;
  type: string;
  amount: string;
  date: string;
  source: string | null;
  notes: string | null;
  accountName: string | null;
  relatedAccountName: string | null;
  categoryName: string | null;
  relatedCategoryName: string | null;
  splits: TransactionSplitRow[];
}

export async function listRecentTransactions(
  userId: string,
  limit = 50
): Promise<TransactionRow[]> {
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      source: transactions.source,
      notes: transactions.notes,
      accountName: accounts.name,
      relatedAccountName: relatedAccounts.name,
      categoryName: categories.name,
      relatedCategoryName: relatedCategories.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(relatedAccounts, eq(transactions.relatedAccountId, relatedAccounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(relatedCategories, eq(transactions.relatedCategoryId, relatedCategories.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  // A split expense has categoryId null on its parent row (categoryName
  // comes back null from the left join above), so this is exactly the set
  // that needs a transaction_splits lookup.
  const splitTxnIds = rows
    .filter((r) => r.type === "expense" && r.categoryName === null)
    .map((r) => r.id);

  const splitsByTxn = new Map<string, TransactionSplitRow[]>();
  if (splitTxnIds.length > 0) {
    const splitRows = await db
      .select({
        transactionId: transactionSplits.transactionId,
        categoryId: transactionSplits.categoryId,
        categoryName: categories.name,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .innerJoin(categories, eq(transactionSplits.categoryId, categories.id))
      .where(inArray(transactionSplits.transactionId, splitTxnIds));

    for (const row of splitRows) {
      const list = splitsByTxn.get(row.transactionId) ?? [];
      list.push({ categoryId: row.categoryId, categoryName: row.categoryName, amount: row.amount });
      splitsByTxn.set(row.transactionId, list);
    }
  }

  return rows.map((row) => ({
    ...row,
    splits: splitsByTxn.get(row.id) ?? [],
  }));
}

// General single-transaction getter (any type, not just split expenses) --
// for the API's GET /api/transactions/[id], which unlike the web edit flow
// isn't scoped to one particular type.
export async function getTransaction(userId: string, id: string): Promise<TransactionRow | null> {
  const [row] = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      source: transactions.source,
      notes: transactions.notes,
      accountName: accounts.name,
      relatedAccountName: relatedAccounts.name,
      categoryName: categories.name,
      relatedCategoryName: relatedCategories.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(relatedAccounts, eq(transactions.relatedAccountId, relatedAccounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(relatedCategories, eq(transactions.relatedCategoryId, relatedCategories.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!row) return null;

  let splits: TransactionSplitRow[] = [];
  if (row.type === "expense" && row.categoryName === null) {
    splits = await db
      .select({
        categoryId: transactionSplits.categoryId,
        categoryName: categories.name,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .innerJoin(categories, eq(transactionSplits.categoryId, categories.id))
      .where(eq(transactionSplits.transactionId, id));
  }

  return { ...row, splits };
}

export interface ListTransactionsOptions {
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedTransactions {
  rows: TransactionRow[];
  total: number;
  limit: number;
  offset: number;
}

// The mobile API's list endpoint needs pagination and account/category/
// date-range filters that listRecentTransactions (used by the web
// Transactions page) was never built for -- rather than bend that
// function to cover both, this is a separate, parallel query so the web
// page's behavior stays exactly as it is.
export async function listTransactionsPaginated(
  userId: string,
  options: ListTransactionsOptions = {}
): Promise<PaginatedTransactions> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [eq(transactions.userId, userId)];
  if (options.accountId) conditions.push(eq(transactions.accountId, options.accountId));
  if (options.categoryId) conditions.push(eq(transactions.categoryId, options.categoryId));
  if (options.dateFrom) conditions.push(gte(transactions.date, options.dateFrom));
  if (options.dateTo) conditions.push(lte(transactions.date, options.dateTo));
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        source: transactions.source,
        notes: transactions.notes,
        accountName: accounts.name,
        relatedAccountName: relatedAccounts.name,
        categoryName: categories.name,
        relatedCategoryName: relatedCategories.name,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(relatedAccounts, eq(transactions.relatedAccountId, relatedAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(relatedCategories, eq(transactions.relatedCategoryId, relatedCategories.id))
      .where(where)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where),
  ]);

  const splitTxnIds = rows.filter((r) => r.type === "expense" && r.categoryName === null).map((r) => r.id);
  const splitsByTxn = new Map<string, TransactionSplitRow[]>();
  if (splitTxnIds.length > 0) {
    const splitRows = await db
      .select({
        transactionId: transactionSplits.transactionId,
        categoryId: transactionSplits.categoryId,
        categoryName: categories.name,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .innerJoin(categories, eq(transactionSplits.categoryId, categories.id))
      .where(inArray(transactionSplits.transactionId, splitTxnIds));

    for (const row of splitRows) {
      const list = splitsByTxn.get(row.transactionId) ?? [];
      list.push({ categoryId: row.categoryId, categoryName: row.categoryName, amount: row.amount });
      splitsByTxn.set(row.transactionId, list);
    }
  }

  return {
    rows: rows.map((row) => ({ ...row, splits: splitsByTxn.get(row.id) ?? [] })),
    total: countRows[0]?.count ?? 0,
    limit,
    offset,
  };
}

export interface SplitTransactionDetail {
  id: string;
  accountId: string;
  accountName: string;
  amount: string;
  date: string;
  source: string | null;
  notes: string | null;
  splits: TransactionSplitRow[];
}

// Only returns a result for a transaction that's actually a split expense
// (type expense, categoryId null) and belongs to this user -- the edit
// flow that uses this is scoped to split expenses only.
export async function getSplitTransaction(
  userId: string,
  id: string
): Promise<SplitTransactionDetail | null> {
  const [row] = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      accountId: transactions.accountId,
      accountName: accounts.name,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      date: transactions.date,
      source: transactions.source,
      notes: transactions.notes,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!row || row.type !== "expense" || row.categoryId !== null || !row.accountId) {
    return null;
  }

  const splitRows = await db
    .select({
      categoryId: transactionSplits.categoryId,
      categoryName: categories.name,
      amount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .innerJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .where(eq(transactionSplits.transactionId, id));

  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName ?? "",
    amount: row.amount,
    date: row.date,
    source: row.source,
    notes: row.notes,
    splits: splitRows,
  };
}
