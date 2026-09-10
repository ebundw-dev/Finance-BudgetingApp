"use server";

import { and, eq, ilike } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, accountTypeEnum, categories, categoryGroups, debts } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

const ACCOUNT_TYPES = new Set(accountTypeEnum.enumValues);

export async function createAccount(formData: FormData): Promise<void> {
  const { userId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const currentBalance = String(formData.get("currentBalance") ?? "0").trim() || "0";
  const isCashAccount = formData.get("isCashAccount") === "on";
  const isDebt = formData.get("isDebt") === "on";

  if (!name || !ACCOUNT_TYPES.has(type as (typeof accountTypeEnum.enumValues)[number])) {
    redirect(
      `/accounts/new?error=${encodeURIComponent("Name and a valid account type are required.")}`
    );
  }
  if (Number.isNaN(Number(currentBalance))) {
    redirect(`/accounts/new?error=${encodeURIComponent("Starting balance must be a number.")}`);
  }

  await db.transaction(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({
        userId,
        name,
        type: type as (typeof accountTypeEnum.enumValues)[number],
        isCashAccount,
        currentBalance,
      })
      .returning();

    // Marking a new account as a debt also creates its dedicated reserve
    // category (see CLAUDE.md's "debt reserve category mechanic") -- every
    // debt needs exactly one, or credit card expenses/payments against it
    // have nowhere to move the offsetting amount.
    if (isDebt) {
      let [group] = await tx
        .select()
        .from(categoryGroups)
        .where(and(eq(categoryGroups.userId, userId), ilike(categoryGroups.name, "debt")));

      if (!group) {
        [group] = await tx
          .insert(categoryGroups)
          .values({ userId, name: "DEBT", sortOrder: 99 })
          .returning();
      }

      const [reserveCategory] = await tx
        .insert(categories)
        .values({
          userId,
          groupId: group.id,
          name: `${name} Reserve`,
          categoryType: "spending",
          allocatedBalance: "0",
        })
        .returning();

      await tx.insert(debts).values({
        userId,
        accountId: account.id,
        categoryId: reserveCategory.id,
        startingBalance: currentBalance,
      });
    }
  });

  redirect("/accounts");
}
