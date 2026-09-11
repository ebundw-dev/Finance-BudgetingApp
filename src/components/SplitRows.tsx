"use client";

import { buttonSecondary, currency, input as inputClass, select as selectClass } from "@/lib/ui";

export interface SplitRowsCategory {
  id: string;
  name: string;
}

export interface SplitRowValue {
  categoryId: string;
  amount: string;
}

// The allocation form's remaining-total UX (src/components/AllocationForm.tsx),
// reused here for splitting one expense across categories instead of
// spreading Unallocated Cash across them.
export function SplitRows({
  categories,
  splits,
  remaining,
  onChange,
  onAdd,
  onRemove,
}: {
  categories: SplitRowsCategory[];
  splits: SplitRowValue[];
  remaining: number;
  onChange: (index: number, patch: Partial<SplitRowValue>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const isBalanced = Math.abs(remaining) < 0.001;

  return (
    <div className="mb-4">
      <div
        className={`mb-3 flex items-center justify-between rounded-md border px-4 py-3 text-sm ${
          isBalanced
            ? "border-border bg-surface text-text"
            : "border-danger/40 bg-danger/10 text-danger"
        }`}
      >
        <span>Remaining to assign</span>
        <span className="text-lg font-semibold tabular-nums">{currency(remaining.toFixed(2))}</span>
      </div>

      <div className="space-y-2">
        {splits.map((split, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              name="splitCategoryId[]"
              required
              className={selectClass}
              value={split.categoryId}
              onChange={(e) => onChange(index, { categoryId: e.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              name="splitAmount[]"
              type="text"
              inputMode="decimal"
              required
              className={`${inputClass} w-28`}
              value={split.amount}
              onChange={(e) => onChange(index, { amount: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={splits.length <= 2}
              className={`${buttonSecondary} px-3 py-1.5 text-xs disabled:opacity-30`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAdd} className={`${buttonSecondary} mt-3 px-3 py-1.5 text-xs`}>
        Add category
      </button>
    </div>
  );
}
