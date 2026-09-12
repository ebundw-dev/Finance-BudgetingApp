"use client";

import type { ImportPreviewRow } from "@/lib/import/matching";
import { checkbox, currency, select as selectClass, table, td, th } from "@/lib/ui";

export interface EditableImportRow extends ImportPreviewRow {
  included: boolean;
  categoryId: string;
}

export function ImportPreviewTable({
  rows,
  categories,
  onToggleIncluded,
  onCategoryChange,
}: {
  rows: EditableImportRow[];
  categories: { id: string; name: string }[];
  onToggleIncluded: (index: number, included: boolean) => void;
  onCategoryChange: (index: number, categoryId: string) => void;
}) {
  return (
    <table className={table}>
      <thead>
        <tr>
          <th className={th}></th>
          <th className={th}>Date</th>
          <th className={th}>Payee</th>
          <th className={th}>Amount</th>
          <th className={th}>Type</th>
          <th className={th}>Category</th>
          <th className={th}>Flags</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className={`hover:bg-surface-hover/60 transition-colors ${row.error ? "opacity-60" : ""}`}
          >
            <td className={td}>
              <input
                type="checkbox"
                className={checkbox}
                checked={row.included}
                disabled={!!row.error}
                onChange={(e) => onToggleIncluded(index, e.target.checked)}
              />
            </td>
            <td className={`${td} whitespace-nowrap`}>{row.date ?? "—"}</td>
            <td className={td}>{row.payeeRaw || "—"}</td>
            <td className={`${td} tabular-nums`}>{row.amount ? currency(row.amount) : "—"}</td>
            <td className={td}>
              {row.direction === "debit" ? "Expense" : row.direction === "credit" ? "Income" : "—"}
            </td>
            <td className={td}>
              {row.direction === "debit" ? (
                <select
                  className={`${selectClass} py-1.5 text-xs`}
                  value={row.categoryId}
                  onChange={(e) => onCategoryChange(index, e.target.value)}
                  disabled={!!row.error}
                >
                  <option value="">Select category…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-text-muted text-xs">—</span>
              )}
            </td>
            <td className={td}>
              {row.error ? (
                <span className="bg-danger/12 text-danger rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  {row.error}
                </span>
              ) : row.isDuplicate ? (
                <span className="bg-warning/12 text-warning rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  Possible duplicate
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
