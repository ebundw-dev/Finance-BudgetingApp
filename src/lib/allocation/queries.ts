import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories } from "@/db/schema";

export async function getUnallocatedCash(userId: string): Promise<string> {
  const [cashRow] = await db
    .select({
      totalCash: sql<string>`coalesce(sum(${accounts.currentBalance}), 0)`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isCashAccount, true)));

  const [categoryRow] = await db
    .select({
      totalAllocated: sql<string>`coalesce(sum(${categories.allocatedBalance}), 0)`,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  return (Number(cashRow.totalCash) - Number(categoryRow.totalAllocated)).toFixed(2);
}
