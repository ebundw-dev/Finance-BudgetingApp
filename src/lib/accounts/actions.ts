"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, accountTypeEnum, categories, categoryGroups, debts, transactions } from "@/db/schema";
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

// Hard delete is only safe for an account with nothing riding on it: a
// nonzero balance is real money (or real debt) that has to go somewhere
// first, and any transaction or debt-tracking link would either orphan
// history or hit the DB's FK constraint. There's no archive alternative
// for accounts (unlike categories) since one wasn't asked for here --
// this covers the "created it by mistake, never used it" case.
export async function deleteAccount(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const accountId = String(formData.get("accountId") ?? "");

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  if (!account) {
    redirect("/accounts");
  }

  if (Number(account.currentBalance) !== 0) {
    redirect(
      `/accounts?error=${encodeURIComponent(
        `"${account.name}" still has a balance -- bring it to $0 (transfer, pay off, or spend down) before deleting.`
      )}`
    );
  }

  const [debtRef] = await db.select({ id: debts.id }).from(debts).where(eq(debts.accountId, accountId)).limit(1);
  if (debtRef) {
    redirect(
      `/accounts?error=${encodeURIComponent(`"${account.name}" is tracked as a debt and can't be deleted.`)}`
    );
  }

  const [txnRef] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.accountId, accountId), eq(transactions.relatedAccountId, accountId)))
    .limit(1);
  if (txnRef) {
    redirect(
      `/accounts?error=${encodeURIComponent(`"${account.name}" has transaction history and can't be deleted.`)}`
    );
  }

  await db.delete(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  redirect("/accounts");
}
