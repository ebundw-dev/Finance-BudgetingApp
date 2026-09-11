"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/Card";
import type { ProgressRow } from "@/lib/months/queries";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Mirrors the palette in globals.css -- recharts needs literal color
// values (SVG stroke props), not CSS custom properties, so these are
// kept in sync by hand rather than read from the theme at runtime.
const COLORS = {
  accent: "#4fb89a",
  danger: "#d9564f",
  info: "#4c7ebf",
  success: "#2e9e6b",
  warning: "#d79a2c",
  textSecondary: "#64716d",
  border: "#e7e0d2",
};

const CATEGORY_LINE_COLORS = [COLORS.accent, COLORS.warning, COLORS.info, COLORS.success, COLORS.danger];

const currencyTick = (value: number) => `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
function currencyTooltip(value: unknown): string {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-5 text-sm font-medium tracking-wide text-text-secondary uppercase">
        {title}
      </h2>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}

export function ProgressCharts({
  rows,
  goalCategoryNames,
}: {
  rows: ProgressRow[];
  goalCategoryNames: string[];
}) {
  const data = rows.map((row) => {
    const point: Record<string, string | number> = {
      label: `${MONTH_NAMES[row.month - 1]} ${row.year}`,
      cash: Number(row.totalCashSnapshot),
      debt: Number(row.totalDebtSnapshot),
      net: Number(row.netPosition),
      cumIncome: Number(row.cumulativeIncome),
      cumDebtPaid: Number(row.cumulativeDebtPaid),
      cumSavings: Number(row.cumulativeSavings),
    };
    for (const name of goalCategoryNames) {
      point[name] = row.categoryBalances[name] ? Number(row.categoryBalances[name]) : 0;
    }
    return point;
  });

  return (
    <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Net Position, Cash & Debt">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
            <YAxis tickFormatter={currencyTick} tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
            <Tooltip formatter={currencyTooltip} contentStyle={{ borderRadius: 8, borderColor: COLORS.border }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="net" name="Net Position" stroke={COLORS.success} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cash" name="Total Cash" stroke={COLORS.accent} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="debt" name="Total Debt" stroke={COLORS.danger} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cumulative Income, Debt Paid & Savings">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
            <YAxis tickFormatter={currencyTick} tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
            <Tooltip formatter={currencyTooltip} contentStyle={{ borderRadius: 8, borderColor: COLORS.border }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="cumIncome" name="Cum. Income" stroke={COLORS.success} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cumDebtPaid" name="Cum. Debt Paid" stroke={COLORS.info} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cumSavings" name="Cum. Savings" stroke={COLORS.warning} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {goalCategoryNames.length > 0 ? (
        <div className="lg:col-span-2">
          <ChartCard title="Goal Categories Over Time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
                <YAxis tickFormatter={currencyTick} tick={{ fontSize: 12, fill: COLORS.textSecondary }} />
                <Tooltip formatter={currencyTooltip} contentStyle={{ borderRadius: 8, borderColor: COLORS.border }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {goalCategoryNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CATEGORY_LINE_COLORS[i % CATEGORY_LINE_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}
    </div>
  );
}
