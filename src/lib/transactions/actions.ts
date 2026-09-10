"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { AccountingError } from "@/lib/accounting/errors";
import {
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordTransfer,
} from "@/lib/accounting/engine";
import { verifySession } from "@/lib/auth/dal";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
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

  redirect("/transactions");
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
    await db.transaction((tx) => recordExpense(tx, userId, params));
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/transactions/new?type=expense&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect("/transactions");
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

  redirect("/transactions");
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

  redirect("/transactions");
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

  redirect("/transactions");
}
