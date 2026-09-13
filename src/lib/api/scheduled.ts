import { scheduledCadenceEnum, scheduledTransactions, transactionTypeEnum } from "@/db/schema";
import { ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

const TYPES = new Set(transactionTypeEnum.enumValues);
const CADENCES = new Set(scheduledCadenceEnum.enumValues);

type TransactionTypeValue = (typeof transactionTypeEnum.enumValues)[number];
type CadenceValue = (typeof scheduledCadenceEnum.enumValues)[number];

export interface CreateScheduledInput {
  type: TransactionTypeValue;
  accountId: string | null;
  relatedAccountId: string | null;
  categoryId: string | null;
  relatedCategoryId: string | null;
  amount: string;
  description: string;
  cadence: CadenceValue;
  intervalDays: number | null;
  nextDueDate: string;
}

function optionalId(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Mirrors src/lib/scheduled/actions.ts's parseScheduledForm exactly (same
// per-type required-field rules, same custom_days interval requirement) --
// a separate copy, not an extracted shared function, so the web app's own
// action file stays untouched. JSON body instead of FormData is the only
// difference.
export function parseCreateScheduledInput(body: unknown): CreateScheduledInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;

  const type = typeof record.type === "string" ? record.type : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const amount = typeof record.amount === "string" ? record.amount.trim() : "";
  const cadence = typeof record.cadence === "string" ? record.cadence : "";
  const nextDueDate = typeof record.nextDueDate === "string" ? record.nextDueDate.trim() : "";
  const accountId = optionalId(record, "accountId");
  const relatedAccountId = optionalId(record, "relatedAccountId");
  const categoryId = optionalId(record, "categoryId");
  const relatedCategoryId = optionalId(record, "relatedCategoryId");

  if (!TYPES.has(type as TransactionTypeValue)) {
    throw new ValidationError("Invalid transaction type.");
  }
  if (!description) {
    throw new ValidationError("A payee or description is required.");
  }
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new ValidationError("A positive amount is required.");
  }
  if (!CADENCES.has(cadence as CadenceValue)) {
    throw new ValidationError("Invalid cadence.");
  }
  if (!nextDueDate) {
    throw new ValidationError("A next due date is required.");
  }

  let intervalDays: number | null = null;
  if (cadence === "custom_days") {
    const intervalDaysRaw =
      typeof record.intervalDays === "number"
        ? String(record.intervalDays)
        : typeof record.intervalDays === "string"
          ? record.intervalDays.trim()
          : "";
    const n = Number(intervalDaysRaw);
    if (!intervalDaysRaw || Number.isNaN(n) || n <= 0) {
      throw new ValidationError("A positive interval (in days) is required for a custom cadence.");
    }
    intervalDays = n;
  }

  switch (type) {
    case "income":
      if (!accountId) throw new ValidationError("An account is required.");
      break;
    case "allocation":
      if (!categoryId) throw new ValidationError("A category is required.");
      break;
    case "expense":
      if (!accountId || !categoryId) throw new ValidationError("An account and a category are required.");
      break;
    case "debt_payment":
      if (!accountId || !relatedAccountId) {
        throw new ValidationError("A source account and a debt account are required.");
      }
      break;
    case "transfer":
      if (!accountId || !relatedAccountId) throw new ValidationError("Both accounts are required.");
      break;
    case "category_reallocation":
      if (!categoryId || !relatedCategoryId) throw new ValidationError("Both categories are required.");
      break;
  }

  return {
    type: type as TransactionTypeValue,
    accountId,
    relatedAccountId,
    categoryId,
    relatedCategoryId,
    amount,
    description,
    cadence: cadence as CadenceValue,
    intervalDays,
    nextDueDate,
  };
}

// Mirrors src/lib/scheduled/actions.ts's createScheduledTransaction --
// just the insert, no redirect. Used both as a general "create a
// scheduled transaction" capability and by the mobile Subscriptions
// screen's "Track it" button (type "expense", pre-filled from a detected
// candidate).
export async function createScheduled(tx: Tx, userId: string, input: CreateScheduledInput) {
  const [created] = await tx
    .insert(scheduledTransactions)
    .values({ userId, ...input })
    .returning();
  return created;
}
