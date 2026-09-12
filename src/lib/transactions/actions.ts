"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { AccountingError } from "@/lib/accounting/errors";
import {
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordSplitExpense,
  recordTransfer,
  updateSplitExpense,
  type SplitItem,
} from "@/lib/accounting/engine";
import { verifySession } from "@/lib/auth/dal";
import { recordPayeeUsage } from "@/lib/payees/service";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitsField(formData: FormData): SplitItem[] {
  const categoryIds = formData.getAll("splitCategoryId[]").map(String);
  const amounts = formData.getAll("splitAmount[]").map(String);
  return categoryIds.map((categoryId, i) => ({
    categoryId,
    amount: (amounts[i] ?? "").trim(),
  }));
}

export async function recordIncomeAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    accountId: field(formData, "accountId"),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    source: field(formData, "source") || undefined,
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction((tx) => recordIncome(tx, userId, params));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/income/new?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Income recorded.")}`);
}

export async function recordExpenseAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    accountId: field(formData, "accountId"),
    categoryId: field(formData, "categoryId"),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    source: field(formData, "source") || undefined,
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction(async (tx) => {
      const txn = await recordExpense(tx, userId, params);
      // Payee tracking is purely a data-entry convenience layered on top of
      // the accounting engine call above, not part of it -- see
      // src/lib/payees/service.ts.
      if (params.source) {
        const payeeId = await recordPayeeUsage(tx, userId, params.source, params.categoryId);
        await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
      }
    });
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=expense&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Expense recorded.")}`);
}

export async function recordSplitExpenseAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    accountId: field(formData, "accountId"),
    splits: splitsField(formData),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    source: field(formData, "source") || undefined,
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction(async (tx) => {
      const txn = await recordSplitExpense(tx, userId, params);
      // A split spans multiple categories, so there's no single "category
      // used" to remember against the payee -- pass null rather than guess.
      if (params.source) {
        const payeeId = await recordPayeeUsage(tx, userId, params.source, null);
        await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
      }
    });
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=expense&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Split expense recorded.")}`);
}

export async function updateSplitExpenseAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const transactionId = field(formData, "transactionId");
  const params = {
    transactionId,
    splits: splitsField(formData),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    source: field(formData, "source") || undefined,
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction(async (tx) => {
      const txn = await updateSplitExpense(tx, userId, params);
      // Always resync payeeId (to a resolved payee, or back to null if the
      // payee field was cleared) rather than only updating when present --
      // this is an edit, so a previously-attached payee can be removed.
      const payeeId = params.source ? await recordPayeeUsage(tx, userId, params.source, null) : null;
      await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
    });
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/${transactionId}/edit?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Split expense updated.")}`);
}

export async function recordTransferAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    fromAccountId: field(formData, "fromAccountId"),
    toAccountId: field(formData, "toAccountId"),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction((tx) => recordTransfer(tx, userId, params));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=transfer&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Transfer recorded.")}`);
}

export async function recordDebtPaymentAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    fromAccountId: field(formData, "fromAccountId"),
    debtAccountId: field(formData, "debtAccountId"),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction((tx) => recordDebtPayment(tx, userId, params));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=debt-payment&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Debt payment recorded.")}`);
}

export async function recordCategoryReallocationAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const params = {
    fromCategoryId: field(formData, "fromCategoryId"),
    toCategoryId: field(formData, "toCategoryId"),
    amount: field(formData, "amount"),
    date: field(formData, "date") || today(),
    notes: field(formData, "notes") || undefined,
  };

  try {
    await db.transaction((tx) => recordCategoryReallocation(tx, userId, params));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=reallocation&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/transactions?success=${encodeURIComponent("Categories reallocated.")}`);
}
