import { eq } from "drizzle-orm";
import { transactions } from "@/db/schema";
import {
  recordExpense,
  recordIncome,
  recordSplitExpense,
  recordTransfer,
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
