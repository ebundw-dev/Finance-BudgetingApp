import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, payees } from "@/db/schema";

export interface PayeeOption {
  id: string;
  name: string;
  lastCategoryId: string | null;
  useCount: number;
}

// Backs the payee combobox on the expense form -- every payee for this
// user, most-used first, so a fresh dropdown (before the user has typed
// anything to filter by) leads with their most common ones.
export async function listPayees(userId: string): Promise<PayeeOption[]> {
  return db
    .select({
      id: payees.id,
      name: payees.name,
      lastCategoryId: payees.lastCategoryId,
      useCount: payees.useCount,
    })
    .from(payees)
    .where(eq(payees.userId, userId))
    .orderBy(desc(payees.useCount));
}

export interface PayeeListItem {
  id: string;
  name: string;
  lastCategoryName: string | null;
  useCount: number;
}

// Backs the /payees management page.
export async function listPayeesForDisplay(userId: string): Promise<PayeeListItem[]> {
  return db
    .select({
      id: payees.id,
      name: payees.name,
      useCount: payees.useCount,
      lastCategoryName: categories.name,
    })
    .from(payees)
    .leftJoin(categories, eq(payees.lastCategoryId, categories.id))
    .where(eq(payees.userId, userId))
    .orderBy(desc(payees.useCount));
}
