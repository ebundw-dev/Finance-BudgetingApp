"use client";

import { useState } from "react";
import type { CategorySpendingRow } from "@/lib/reports/queries";
import { currency, table, td, th } from "@/lib/ui";

export function CategorySpendingTable({
  rows,
  totalSpending,
}: {
  rows: CategorySpendingRow[];
  totalSpending: number;
}) {
  const [sortAscending, setSortAscending] = useState(false);

  const sorted = [...rows].sort((a, b) =>
    sortAscending ? Number(a.total) - Number(b.total) : Number(b.total) - Number(a.total)
  );

  return (
    <table className={table}>
      <thead>
        <tr>
          <th className={th}>Category</th>
          <th className={th}>Group</th>
          <th className={th}>
            <button
              type="button"
              onClick={() => setSortAscending((v) => !v)}
              className="flex items-center gap-1 hover:text-text"
            >
              Amount {sortAscending ? "↑" : "↓"}
            </button>
          </th>
          <th className={th}>% of total</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.categoryId} className="hover:bg-surface-hover/60 transition-colors">
            <td className={td}>{row.categoryName}</td>
            <td className={td}>{row.groupName}</td>
            <td className={`${td} tabular-nums`}>{currency(row.total)}</td>
            <td className={`${td} tabular-nums`}>
              {totalSpending > 0 ? `${((Number(row.total) / totalSpending) * 100).toFixed(1)}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
