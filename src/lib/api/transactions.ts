import { eq } from "drizzle-orm";
import { transactions } from "@/db/schema";
import {
  recordExpense,
  recordIncome,
  recordSplitExpense,
  recordTransfer,
  updateExpense,
  updateSplitExpense,
  type SplitItem,
  type Tx,
} from "@/lib/accounting/engine";
import { ValidationError } from "@/lib/accounting/errors";
import { recordPayeeUsage } from "@/lib/payees/service";

export type CreateTransactionInput =
  | { type: "expense"; accountId: string; categoryId: string; amount: string; date: string; source?: string; notes?: string }
  | { type: "income"; accountId: string; amount: string; date: string; source?: string; notes?: string }
  | { type: "transfer"; fromAccountId: string; toAccountId: string; amount: string; date: string; notes?: string }
  | { type: "split_expense"; accountId: string; splits: SplitItem[]; amount: string; date: string; source?: string; notes?: string };

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${key} is required.`);
  }
  return value;
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

// Validates the JSON body's shape (required fields present, correct
// primitive types) -- the same "is this field even here" checking the
// FormData-based Server Actions do via their field()/required-field
// checks. Business validation (does this account/category exist, is
// there enough balance) is NOT duplicated here; that's the accounting
// engine's job, same as it is for every other caller.
export function parseCreateTransactionInput(body: unknown): CreateTransactionInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const type = record.type;
  const amount = requireString(record, "amount");
  const date = requireString(record, "date");

  switch (type) {
    case "expense":
      return {
        type: "expense",
        accountId: requireString(record, "accountId"),
        categoryId: requireString(record, "categoryId"),
        amount,
        date,
        source: optionalString(record, "source"),
        notes: optionalString(record, "notes"),
      };
    case "income":
      return {
        type: "income",
        accountId: requireString(record, "accountId"),
        amount,
        date,
        source: optionalString(record, "source"),
        notes: optionalString(record, "notes"),
      };
    case "transfer":
      return {
        type: "transfer",
        fromAccountId: requireString(record, "fromAccountId"),
        toAccountId: requireString(record, "toAccountId"),
        amount,
        date,
        notes: optionalString(record, "notes"),
      };
    case "split_expense": {
      const splits = record.splits;
      if (!Array.isArray(splits) || splits.length < 2) {
        throw new ValidationError("splits must be an array of at least two {categoryId, amount} items.");
      }
      const parsedSplits: SplitItem[] = splits.map((split, index) => {
        if (!split || typeof split !== "object") {
          throw new ValidationError(`splits[${index}] must be an object.`);
        }
        const splitRecord = split as Record<string, unknown>;
        return {
          categoryId: requireString(splitRecord, "categoryId"),
          amount: requireString(splitRecord, "amount"),
        };
      });
      return {
        type: "split_expense",
        accountId: requireString(record, "accountId"),
        splits: parsedSplits,
        amount,
        date,
        source: optionalString(record, "source"),
        notes: optionalString(record, "notes"),
      };
    }
    default:
      throw new ValidationError('type must be one of "expense", "income", "transfer", "split_expense".');
  }
}

// The same shape import/actions.ts's per-row posting uses: call the
// accounting engine function directly (not the FormData Server Action
// wrapper), then run payee tracking for expense rows inside the same
// transaction. No parallel accounting logic -- recordExpense/recordIncome/
// recordSplitExpense/recordTransfer are the exact functions the web
// forms call.
export async function createTransaction(tx: Tx, userId: string, input: CreateTransactionInput) {
  switch (input.type) {
    case "expense": {
      const txn = await recordExpense(tx, userId, input);
      if (input.source) {
        const payeeId = await recordPayeeUsage(tx, userId, input.source, input.categoryId);
        await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
        return { ...txn, payeeId };
      }
      return txn;
    }
    case "income":
      return recordIncome(tx, userId, input);
    case "transfer":
      return recordTransfer(tx, userId, input);
    case "split_expense": {
      const txn = await recordSplitExpense(tx, userId, input);
      if (input.source) {
        const payeeId = await recordPayeeUsage(tx, userId, input.source, null);
        await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
        return { ...txn, payeeId };
      }
      return txn;
    }
  }
}

export type UpdateTransactionInput =
  | { kind: "expense"; categoryId: string; amount: string; date: string; source?: string; notes?: string }
  | { kind: "split_expense"; splits: SplitItem[]; amount: string; date: string; source?: string; notes?: string };

// Which engine function to call is inferred from the body's own shape
// (a "splits" array means a split-expense edit, "categoryId" means a
// plain one) rather than requiring the client to also resend "type" --
// account/type are immutable on edit anyway, so there's nothing else
// that would disambiguate it.
export function parseUpdateTransactionInput(body: unknown): UpdateTransactionInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const amount = requireString(record, "amount");
  const date = requireString(record, "date");

  if (Array.isArray(record.splits)) {
    const splits = record.splits;
    if (splits.length < 2) {
      throw new ValidationError("splits must be an array of at least two {categoryId, amount} items.");
    }
    const parsedSplits: SplitItem[] = splits.map((split, index) => {
      if (!split || typeof split !== "object") {
        throw new ValidationError(`splits[${index}] must be an object.`);
      }
      const splitRecord = split as Record<string, unknown>;
      return {
        categoryId: requireString(splitRecord, "categoryId"),
        amount: requireString(splitRecord, "amount"),
      };
    });
    return {
      kind: "split_expense",
      splits: parsedSplits,
      amount,
      date,
      source: optionalString(record, "source"),
      notes: optionalString(record, "notes"),
    };
  }

  return {
    kind: "expense",
    categoryId: requireString(record, "categoryId"),
    amount,
    date,
    source: optionalString(record, "source"),
    notes: optionalString(record, "notes"),
  };
}

// Mirrors updateSplitExpenseAction's payee handling exactly (see
// src/lib/transactions/actions.ts): always resync payeeId -- to a
// resolved payee, or back to null if the source field was cleared --
// rather than only updating when present, since this is an edit.
export async function updateTransaction(
  tx: Tx,
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput
) {
  if (input.kind === "expense") {
    const txn = await updateExpense(tx, userId, {
      transactionId,
      categoryId: input.categoryId,
      amount: input.amount,
      date: input.date,
      source: input.source,
      notes: input.notes,
    });
    const payeeId = input.source ? await recordPayeeUsage(tx, userId, input.source, input.categoryId) : null;
    await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
    return { ...txn, payeeId };
  }

  const txn = await updateSplitExpense(tx, userId, {
    transactionId,
    splits: input.splits,
    amount: input.amount,
    date: input.date,
    source: input.source,
    notes: input.notes,
  });
  const payeeId = input.source ? await recordPayeeUsage(tx, userId, input.source, null) : null;
  await tx.update(transactions).set({ payeeId }).where(eq(transactions.id, txn.id));
  return { ...txn, payeeId };
}
