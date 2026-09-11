"use client";

import { useState } from "react";
import { SplitRows, type SplitRowValue, type SplitRowsCategory } from "@/components/SplitRows";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, field, input as inputClass, label as labelClass } from "@/lib/ui";

export function EditSplitExpenseForm({
  transactionId,
  categories,
  initialAmount,
  initialDate,
  initialSource,
  initialSplits,
  action,
}: {
  transactionId: string;
  categories: SplitRowsCategory[];
  initialAmount: string;
  initialDate: string;
  initialSource: string;
  initialSplits: SplitRowValue[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [splits, setSplits] = useState<SplitRowValue[]>(initialSplits);

  const splitTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remaining = (Number(amount) || 0) - splitTotal;
  const isBalanced = Math.abs(remaining) < 0.001 && Number(amount) > 0;

  function updateSplit(index: number, patch: Partial<SplitRowValue>) {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSplitRow() {
    const usedIds = new Set(splits.map((s) => s.categoryId));
    const next = categories.find((c) => !usedIds.has(c.id)) ?? categories[0];
    setSplits((prev) => [...prev, { categoryId: next?.id ?? "", amount: "" }]);
  }

  function removeSplitRow(index: number) {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={action}>
      <input type="hidden" name="transactionId" value={transactionId} />

      <div className={field}>
        <label htmlFor="amount" className={labelClass}>
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <SplitRows
        categories={categories}
        splits={splits}
        remaining={remaining}
        onChange={updateSplit}
        onAdd={addSplitRow}
        onRemove={removeSplitRow}
      />

      <div className={field}>
        <label htmlFor="date" className={labelClass}>
          Date
        </label>
        <input id="date" name="date" type="date" defaultValue={initialDate} className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="source" className={labelClass}>
          Merchant / source
        </label>
        <input
          id="source"
          name="source"
          type="text"
          defaultValue={initialSource}
          className={inputClass}
        />
      </div>

      <SubmitButton className={buttonPrimary} disabled={!isBalanced} pendingLabel="Saving…">
        Save Changes
      </SubmitButton>
    </form>
  );
}
