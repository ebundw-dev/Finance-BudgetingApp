"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, currency, input as inputClass, table, td, th } from "@/lib/ui";

export interface AllocationCategory {
  id: string;
  name: string;
  priority: string | null;
  allocatedBalance: string;
}

export function AllocationForm({
  categories,
  unallocatedCash,
  showPriorityOnly,
  action,
}: {
  categories: AllocationCategory[];
  unallocatedCash: string;
  showPriorityOnly: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const totalEntered = useMemo(
    () => Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [amounts]
  );
  const remaining = Number(unallocatedCash) - totalEntered;
  const overAllocated = remaining < -0.001;

  return (
    <form action={action}>
      {showPriorityOnly ? <input type="hidden" name="priority" value="1" /> : null}

      <div
        className={`mb-4 flex items-center justify-between rounded-md border px-4 py-3 text-sm ${
          overAllocated
            ? "border-danger/40 bg-danger/10 text-danger"
            : "border-border bg-surface text-text"
        }`}
      >
        <span>Remaining to allocate</span>
        <span className="text-lg font-semibold tabular-nums">{currency(remaining.toFixed(2))}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Category</th>
              <th className={th}>Current Balance</th>
              <th className={th}>Amount to Allocate</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className={td}>
                  {category.name}
                  {category.priority ? ` (${category.priority})` : ""}
                </td>
                <td className={`${td} tabular-nums`}>{currency(category.allocatedBalance)}</td>
                <td className={td}>
                  <input type="hidden" name="categoryId[]" value={category.id} />
                  <input
                    name="amount[]"
                    type="text"
                    inputMode="decimal"
                    defaultValue="0"
                    className={`${inputClass} w-28`}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [category.id]: e.target.value }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <SubmitButton className={buttonPrimary} disabled={overAllocated} pendingLabel="Allocating…">
          Allocate
        </SubmitButton>
        {overAllocated ? (
          <span className="text-sm text-danger">Reduce amounts to match what&apos;s available.</span>
        ) : null}
      </div>
    </form>
  );
}
