import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  allocationRules,
  categories,
  categoryGroups,
  debts,
  goals,
  scheduledTransactions,
  transactions,
  transactionSplits,
} from "@/db/schema";

export interface FullDataExport {
  exportedAt: string;
  accounts: (typeof accounts.$inferSelect)[];
  categoryGroups: (typeof categoryGroups.$inferSelect)[];
  categories: (typeof categories.$inferSelect)[];
  transactions: (typeof transactions.$inferSelect)[];
  transactionSplits: (typeof transactionSplits.$inferSelect)[];
  goals: (typeof goals.$inferSelect)[];
  debts: (typeof debts.$inferSelect)[];
  ruleSets: (typeof allocationRules.$inferSelect)[];
  scheduledTransactions: (typeof scheduledTransactions.$inferSelect)[];
}

// Every row this user owns, unfiltered (archived accounts/categories
// included, unlike the "active only" list queries the app's own pages
// use) -- this is a backup, not a working view. transactionSplits has no
// userId column of its own (it's a child of transactions), so it's
// scoped via a join instead. categoryGroups is included even though it
// wasn't explicitly asked for: categories.groupId would otherwise be a
// dangling reference with no group name/order to go with it, which isn't
// a "complete" export of the data.
export async function exportAllUserData(userId: string): Promise<FullDataExport> {
  const [
    accountRows,
    categoryGroupRows,
    categoryRows,
    transactionRows,
    splitRows,
    goalRows,
    debtRows,
    ruleRows,
    scheduledRows,
  ] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categoryGroups).where(eq(categoryGroups.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db
      .select({
        id: transactionSplits.id,
        transactionId: transactionSplits.transactionId,
        categoryId: transactionSplits.categoryId,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
      .where(eq(transactions.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(debts).where(eq(debts.userId, userId)),
    db.select().from(allocationRules).where(eq(allocationRules.userId, userId)),
    db.select().from(scheduledTransactions).where(eq(scheduledTransactions.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    accounts: accountRows,
    categoryGroups: categoryGroupRows,
    categories: categoryRows,
    transactions: transactionRows,
    transactionSplits: splitRows,
    goals: goalRows,
    debts: debtRows,
    ruleSets: ruleRows,
    scheduledTransactions: scheduledRows,
  };
}
