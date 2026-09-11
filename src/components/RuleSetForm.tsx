"use client";

import { useState, useTransition } from "react";
import { createRuleSet, type CreateRuleSetState } from "@/lib/rules/actions";
import { buttonPrimary, errorBanner, field, input, label as labelClass, select as selectClass } from "@/lib/ui";

const ROW_COUNT = 8;

interface Row {
  categoryId: string;
  percentage: string;
}

function emptyRows(): Row[] {
  return Array.from({ length: ROW_COUNT }, () => ({ categoryId: "", percentage: "" }));
}

// Deliberately NOT <form action={fn}> + useActionState: React 19 resets
// that kind of form after every dispatch (native form.reset() semantics),
// including on a validation failure. A controlled <input> mostly survives
// that reset via React's own re-sync, but a controlled <select> only
// sometimes wins the fight -- confirmed flaky even with a
// useActionState-driven remount key, on a hard page reload's first
// submission in particular. Calling the action directly from a plain
// onSubmit handler sidesteps the auto-reset mechanism entirely: every
// field here is driven solely by its own onChange, never touched by the
// server round-trip.
export function RuleSetForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result: CreateRuleSetState = await createRuleSet({}, formData);
      setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={field}>
        <label htmlFor="ruleName" className={labelClass}>
          Name
        </label>
        <input
          id="ruleName"
          name="ruleName"
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Leave a row blank to skip it. Percentages across all filled-in rows must sum to 100.
      </p>
      <div className="mb-4 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <select
              name="categoryId[]"
              value={row.categoryId}
              onChange={(e) => updateRow(i, { categoryId: e.target.value })}
              className={selectClass}
            >
              <option value="">— none —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              name="percentage[]"
              type="text"
              inputMode="decimal"
              placeholder="%"
              value={row.percentage}
              onChange={(e) => updateRow(i, { percentage: e.target.value })}
              className={`${input} w-20`}
            />
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={buttonPrimary} disabled={pending} aria-busy={pending}>
        {pending ? "Creating…" : "Create Rule Set"}
      </button>
    </form>
  );
}
