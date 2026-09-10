import "server-only";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";

const relatedAccounts = alias(accounts, "related_accounts");
const relatedCategories = alias(categories, "related_categories");

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
}

export async function listRecentTransactions(
  userId: string,
  limit = 50
): Promise<TransactionRow[]> {
  return db
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
}
