"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  scheduledCadenceEnum,
  scheduledTransactions,
  transactionTypeEnum,
} from "@/db/schema";
import { AccountingError } from "@/lib/accounting/errors";
import {
  recordAllocation,
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordTransfer,
  type Tx,
} from "@/lib/accounting/engine";
import { verifySession } from "@/lib/auth/dal";
import { computeNextDueDate } from "./cadence";
import { getScheduledTransaction } from "./queries";

const TYPES = new Set(transactionTypeEnum.enumValues);
const CADENCES = new Set(scheduledCadenceEnum.enumValues);

type ScheduledRow = typeof scheduledTransactions.$inferSelect;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Dispatches to the same accounting engine function a manual entry of this
// type would use, with the scheduled transaction's stored account/
// category ids -- the mapping mirrors the transactions table's own
// column-usage comment in schema.ts exactly. Posts as of today (not the
// possibly-overdue nextDueDate), same as confirming any other pending
// action. Never touches transactions/categories/accounts outside of these
// existing engine functions.
async function postScheduled(tx: Tx, userId: string, scheduled: ScheduledRow, amount: string) {
  const date = today();
  const notes = scheduled.description;

  switch (scheduled.type) {
    case "income":
      return recordIncome(tx, userId, {
        accountId: scheduled.accountId!,
        amount,
        date,
        source: scheduled.description,
      });
    case "expense":
      return recordExpense(tx, userId, {
        accountId: scheduled.accountId!,
        categoryId: scheduled.categoryId!,
        amount,
        date,
        source: scheduled.description,
      });
    case "allocation":
      return recordAllocation(tx, userId, {
        categoryId: scheduled.categoryId!,
        amount,
        date,
        notes,
      });
    case "debt_payment":
      return recordDebtPayment(tx, userId, {
        fromAccountId: scheduled.accountId!,
        debtAccountId: scheduled.relatedAccountId!,
        amount,
        date,
        notes,
      });
    case "transfer":
      return recordTransfer(tx, userId, {
        fromAccountId: scheduled.accountId!,
        toAccountId: scheduled.relatedAccountId!,
        amount,
        date,
        notes,
      });
    case "category_reallocation":
      return recordCategoryReallocation(tx, userId, {
        fromCategoryId: scheduled.categoryId!,
        toCategoryId: scheduled.relatedCategoryId!,
        amount,
        date,
        notes,
      });
  }
}

interface ParsedScheduledValues {
  type: (typeof transactionTypeEnum.enumValues)[number];
  accountId: string | null;
  relatedAccountId: string | null;
  categoryId: string | null;
  relatedCategoryId: string | null;
  amount: string;
  description: string;
  cadence: (typeof scheduledCadenceEnum.enumValues)[number];
  intervalDays: number | null;
  nextDueDate: string;
}

function parseScheduledForm(formData: FormData): { error: string } | { values: ParsedScheduledValues } {
  const type = String(formData.get("type") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "");
  const intervalDaysRaw = String(formData.get("intervalDays") ?? "").trim();
  const nextDueDate = String(formData.get("nextDueDate") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "").trim() || null;
  const relatedAccountId = String(formData.get("relatedAccountId") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const relatedCategoryId = String(formData.get("relatedCategoryId") ?? "").trim() || null;

  if (!TYPES.has(type as (typeof transactionTypeEnum.enumValues)[number])) {
    return { error: "Invalid transaction type." };
  }
  if (!description) {
    return { error: "A payee or description is required." };
  }
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return { error: "A positive amount is required." };
  }
  if (!CADENCES.has(cadence as (typeof scheduledCadenceEnum.enumValues)[number])) {
    return { error: "Invalid cadence." };
  }
  if (!nextDueDate) {
    return { error: "A next due date is required." };
  }

  let intervalDays: number | null = null;
  if (cadence === "custom_days") {
    const n = Number(intervalDaysRaw);
    if (!intervalDaysRaw || Number.isNaN(n) || n <= 0) {
      return { error: "A positive interval (in days) is required for a custom cadence." };
    }
    intervalDays = n;
  }

  switch (type) {
    case "income":
      if (!accountId) return { error: "An account is required." };
      break;
    case "allocation":
      if (!categoryId) return { error: "A category is required." };
      break;
    case "expense":
      if (!accountId || !categoryId) return { error: "An account and a category are required." };
      break;
    case "debt_payment":
      if (!accountId || !relatedAccountId) {
        return { error: "A source account and a debt account are required." };
      }
      break;
    case "transfer":
      if (!accountId || !relatedAccountId) return { error: "Both accounts are required." };
      break;
    case "category_reallocation":
      if (!categoryId || !relatedCategoryId) return { error: "Both categories are required." };
      break;
  }

  return {
    values: {
      type: type as (typeof transactionTypeEnum.enumValues)[number],
      accountId,
      relatedAccountId,
      categoryId,
      relatedCategoryId,
      amount,
      description,
      cadence: cadence as (typeof scheduledCadenceEnum.enumValues)[number],
      intervalDays,
      nextDueDate,
    },
  };
}

export async function createScheduledTransaction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const type = String(formData.get("type") ?? "expense");
  const parsed = parseScheduledForm(formData);

  if ("error" in parsed) {
    redirect(`/scheduled/new?type=${type}&error=${encodeURIComponent(parsed.error)}`);
  }

  await db.insert(scheduledTransactions).values({ userId, ...parsed.values });

  redirect(`/scheduled?success=${encodeURIComponent("Scheduled transaction created.")}`);
}

export async function updateScheduledTransaction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const id = String(formData.get("scheduledId") ?? "");
  const type = String(formData.get("type") ?? "expense");
  const parsed = parseScheduledForm(formData);

  if ("error" in parsed) {
    redirect(`/scheduled/${id}/edit?type=${type}&error=${encodeURIComponent(parsed.error)}`);
  }

  await db
    .update(scheduledTransactions)
    .set(parsed.values)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, userId)));

  redirect(`/scheduled?success=${encodeURIComponent("Scheduled transaction updated.")}`);
}

export async function toggleScheduledActive(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const id = String(formData.get("scheduledId") ?? "");
  const isActive = formData.get("isActive") === "true";

  await db
    .update(scheduledTransactions)
    .set({ isActive: !isActive })
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, userId)));

  redirect("/scheduled");
}

// Posts the scheduled transaction as a real one (via the same engine
// function a manual entry would use) and advances nextDueDate, atomically
// -- if the accounting engine rejects it (e.g. insufficient category
// balance), the whole transaction rolls back and nextDueDate does not
// move, so a failed confirm can be retried rather than silently drifting
// the schedule forward.
export async function confirmScheduledTransaction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const id = String(formData.get("scheduledId") ?? "");
  const amountOverride = String(formData.get("amount") ?? "").trim();

  const scheduled = await getScheduledTransaction(userId, id);
  if (!scheduled) {
    redirect("/scheduled");
  }

  const amount = amountOverride || scheduled.amount;
  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    redirect(`/scheduled?error=${encodeURIComponent("Amount must be a positive number.")}`);
  }

  try {
    await db.transaction(async (tx) => {
      await postScheduled(tx, userId, scheduled, amount);
      const nextDueDate = computeNextDueDate(scheduled.nextDueDate, scheduled.cadence, scheduled.intervalDays);
      await tx
        .update(scheduledTransactions)
        .set({ nextDueDate })
        .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, userId)));
    });
  } catch (error) {
    if (error instanceof AccountingError) {
      redirect(`/scheduled?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/scheduled?success=${encodeURIComponent(`"${scheduled.description}" posted.`)}`);
}

// Advances nextDueDate without posting anything -- no accounting engine
// call at all, so there's nothing to roll back and nothing that can fail
// except the row not existing.
export async function skipScheduledTransaction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const id = String(formData.get("scheduledId") ?? "");

  const scheduled = await getScheduledTransaction(userId, id);
  if (!scheduled) {
    redirect("/scheduled");
  }

  const nextDueDate = computeNextDueDate(scheduled.nextDueDate, scheduled.cadence, scheduled.intervalDays);
  await db
    .update(scheduledTransactions)
    .set({ nextDueDate })
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, userId)));

  redirect(`/scheduled?success=${encodeURIComponent(`Skipped "${scheduled.description}".`)}`);
}
