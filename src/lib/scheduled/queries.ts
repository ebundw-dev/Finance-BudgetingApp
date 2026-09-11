import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledTransactions } from "@/db/schema";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDaysString(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listScheduledTransactions(userId: string) {
  return db
    .select()
    .from(scheduledTransactions)
    .where(eq(scheduledTransactions.userId, userId))
    .orderBy(asc(scheduledTransactions.nextDueDate));
}

// Active and due today or earlier -- these get the one-tap confirm/skip
// treatment. Never auto-posted; see src/lib/scheduled/actions.ts.
export async function listDueScheduledTransactions(userId: string) {
  return db
    .select()
    .from(scheduledTransactions)
    .where(
      and(
        eq(scheduledTransactions.userId, userId),
        eq(scheduledTransactions.isActive, true),
        lte(scheduledTransactions.nextDueDate, todayString())
      )
    )
    .orderBy(asc(scheduledTransactions.nextDueDate));
}

// Active, due within the next 7 days but not yet due today -- shown as a
// lighter-weight "coming up" list, no confirm/skip action needed yet.
export async function listUpcomingScheduledTransactions(userId: string) {
  const today = todayString();
  const in7Days = inDaysString(7);
  return db
    .select()
    .from(scheduledTransactions)
    .where(
      and(
        eq(scheduledTransactions.userId, userId),
        eq(scheduledTransactions.isActive, true),
        lte(scheduledTransactions.nextDueDate, in7Days)
      )
    )
    .orderBy(asc(scheduledTransactions.nextDueDate))
    .then((rows) => rows.filter((row) => row.nextDueDate > today));
}

export async function getDueAndUpcomingCounts(
  userId: string
): Promise<{ dueCount: number; upcomingCount: number }> {
  const [due, upcoming] = await Promise.all([
    listDueScheduledTransactions(userId),
    listUpcomingScheduledTransactions(userId),
  ]);
  return { dueCount: due.length, upcomingCount: upcoming.length };
}

export async function getScheduledTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, userId)));
  return row;
}
