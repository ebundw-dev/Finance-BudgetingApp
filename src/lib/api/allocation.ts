import { recordBulkAllocation, type BulkAllocationItem, type Tx } from "@/lib/accounting/engine";
import { ValidationError } from "@/lib/accounting/errors";

export interface SubmitAllocationInput {
  items: BulkAllocationItem[];
  date?: string;
  notes?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Validates the JSON body's shape only (items is a non-empty array of
// {categoryId, amount} strings) -- the same "is this field even here"
// checking the FormData-based allocateAction does before ever calling
// recordBulkAllocation. Business validation (positive amounts, no
// duplicate categories, enough Unallocated Cash) is the engine's job,
// not duplicated here.
export function parseSubmitAllocationInput(body: unknown): SubmitAllocationInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const items = record.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("items must be a non-empty array of {categoryId, amount}.");
  }

  const parsedItems: BulkAllocationItem[] = items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`items[${index}] must be an object.`);
    }
    const itemRecord = item as Record<string, unknown>;
    const categoryId = itemRecord.categoryId;
    const amount = itemRecord.amount;
    if (typeof categoryId !== "string" || !categoryId.trim()) {
      throw new ValidationError(`items[${index}].categoryId is required.`);
    }
    if (typeof amount !== "string" || !amount.trim()) {
      throw new ValidationError(`items[${index}].amount is required.`);
    }
    return { categoryId, amount };
  });

  const date = typeof record.date === "string" && record.date.trim() ? record.date : undefined;
  const notes = typeof record.notes === "string" && record.notes.trim() ? record.notes : undefined;

  return { items: parsedItems, date, notes };
}

export async function submitAllocation(tx: Tx, userId: string, input: SubmitAllocationInput) {
  return recordBulkAllocation(tx, userId, input.items, { date: input.date ?? today(), notes: input.notes });
}
