import type { Tone } from "./theme";
import type { TransactionType } from "./api";

// Mirrors the TYPE_BADGE tone mapping in src/app/(app)/transactions/page.tsx
// (web only tones the type pill, not the amount text -- mobile also
// applies this to the amount, per this phase's own requirement to color
// amounts by type).
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  allocation: "Allocation",
  expense: "Expense",
  debt_payment: "Debt Payment",
  transfer: "Transfer",
  category_reallocation: "Reallocation",
};

export const TRANSACTION_TYPE_TONE: Record<TransactionType, Tone> = {
  income: "success",
  allocation: "accent",
  expense: "danger",
  debt_payment: "warning",
  transfer: "default",
  category_reallocation: "default",
};
