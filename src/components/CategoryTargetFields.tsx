"use client";

import { useState } from "react";
import { field, input, label as labelClass, select as selectClass } from "@/lib/ui";

const TARGET_TYPES: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "refill_up_to", label: "Refill Up To" },
  { value: "set_aside_monthly", label: "Set Aside Monthly" },
  { value: "by_date", label: "By Date" },
];

export function CategoryTargetFields({
  initialType,
  initialAmount,
  initialCadence,
  initialDate,
}: {
  initialType: string | null;
  initialAmount: string | null;
  initialCadence: string | null;
  initialDate: string | null;
}) {
  const [type, setType] = useState(initialType ?? "");

  return (
    <div className={field}>
      <label className={labelClass}>Target</label>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TARGET_TYPES.map((t) => (
          <label
            key={t.value || "none"}
            className={
              "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors " +
              (type === t.value
                ? "border-accent bg-accent/12 text-accent font-medium"
                : "border-border text-text-secondary hover:text-text")
            }
          >
            <input
              type="radio"
              name="targetType"
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>

      {type !== "" ? (
        <div className={field}>
          <label htmlFor="targetAmount" className={labelClass}>
            {type === "by_date" ? "Total amount needed" : "Target amount"}
          </label>
          <input
            id="targetAmount"
            name="targetAmount"
            type="text"
            inputMode="decimal"
            required
            defaultValue={initialAmount ?? ""}
            className={input}
          />
        </div>
      ) : null}

      {type === "refill_up_to" ? (
        <div className={field}>
          <label htmlFor="targetCadence" className={labelClass}>
            Refill cadence (optional -- for display only)
          </label>
          <select
            id="targetCadence"
            name="targetCadence"
            defaultValue={initialCadence ?? ""}
            className={selectClass}
          >
            <option value="">—</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      ) : null}

      {type === "set_aside_monthly" ? (
        <p className="text-text-muted -mt-2 mb-4 text-xs">
          This amount is expected every calendar month, regardless of leftover balance --
          there&apos;s no cap.
        </p>
      ) : null}

      {type === "by_date" ? (
        <div className={field}>
          <label htmlFor="targetDate" className={labelClass}>
            Target date
          </label>
          <input
            id="targetDate"
            name="targetDate"
            type="date"
            required
            defaultValue={initialDate ?? ""}
            className={input}
          />
          <p className="text-text-muted mt-1 text-xs">
            The monthly amount needed is calculated from today&apos;s date, the amount already
            saved, and this deadline.
          </p>
        </div>
      ) : null}
    </div>
  );
}
