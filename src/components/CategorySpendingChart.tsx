"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/Card";
import type { CategorySpendingRow } from "@/lib/reports/queries";

// Mirrors the palette in globals.css -- recharts needs literal color
// values (SVG props), not CSS custom properties, so these are kept in
// sync by hand rather than read from the theme at runtime. Same values
// ProgressCharts.tsx uses.
const COLORS = {
  accent: "#4fb89a",
  textSecondary: "#64716d",
  border: "#e7e0d2",
};

// Below $1k, show whole dollars instead of the compact "$0.1k" style the
// dashboard's larger-figure charts use -- a month's spending by category is
// often under $1,000 total, where "$0.1k" reads far worse than "$100".
const currencyTick = (value: number) =>
  Math.abs(value) < 1000 ? `$${value.toFixed(0)}` : `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
function currencyTooltip(value: unknown): string {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Horizontal bars (recharts' "vertical" layout) rather than the usual
// upright bar chart -- category names are free text of very different
// lengths, and a horizontal list sorted descending reads the same way a
// spending report's ranking naturally does, without rotating axis labels.
export function CategorySpendingChart({ rows }: { rows: CategorySpendingRow[] }) {
  const data = rows.map((row) => ({ name: row.categoryName, total: Number(row.total) }));
  const height = Math.max(240, rows.length * 36);

  return (
    <Card>
      <h2 className="mb-5 text-sm font-medium tracking-wide text-text-secondary uppercase">
        Spending by Category
      </h2>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={currencyTick}
              tick={{ fontSize: 12, fill: COLORS.textSecondary }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 12, fill: COLORS.textSecondary }}
            />
            <Tooltip formatter={currencyTooltip} contentStyle={{ borderRadius: 8, borderColor: COLORS.border }} />
            <Bar dataKey="total" name="Spent" fill={COLORS.accent} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
