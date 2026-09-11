"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, monthCategorySnapshots, months } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { getCurrentAggregates } from "./queries";

// Snapshots the CURRENT live aggregates (cash/debt/unallocated, plus every
// goal category's balance) under the given year/month. Only meaningful for
// the current month or very recent history -- it always captures "now,"
// not a reconstruction of what the numbers actually were at that month's
// end, so re-running it for a truly past month would just overwrite that
// month's snapshot with today's numbers. The UI only exposes this for the
// current month.
export async function closeMonth(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));

  const { totalCash, totalDebt, unallocatedCash } = await getCurrentAggregates(userId);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: months.id })
      .from(months)
      .where(and(eq(months.userId, userId), eq(months.year, year), eq(months.month, month)));

    const monthId = existing
      ? existing.id
      : (
          await tx
            .insert(months)
            .values({
              userId,
              year,
              month,
              totalCashSnapshot: totalCash,
              totalDebtSnapshot: totalDebt,
              unallocatedCashSnapshot: unallocatedCash,
            })
            .returning({ id: months.id })
        )[0].id;

    if (existing) {
      await tx
        .update(months)
        .set({
          totalCashSnapshot: totalCash,
          totalDebtSnapshot: totalDebt,
          unallocatedCashSnapshot: unallocatedCash,
        })
        .where(eq(months.id, monthId));
      await tx.delete(monthCategorySnapshots).where(eq(monthCategorySnapshots.monthId, monthId));
    }

    const goalCategories = await tx
      .select({ id: categories.id, allocatedBalance: categories.allocatedBalance })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.categoryType, "goal")));

    if (goalCategories.length > 0) {
      await tx.insert(monthCategorySnapshots).values(
        goalCategories.map((category) => ({
          monthId,
          categoryId: category.id,
          allocatedBalance: category.allocatedBalance,
        }))
      );
    }
  });

  redirect(`/monthly?year=${year}&month=${month}`);
}
