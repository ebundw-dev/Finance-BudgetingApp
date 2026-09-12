"use client";

import { useState } from "react";
import { PayeeCombobox } from "@/components/PayeeCombobox";
import { SplitRows, type SplitRowValue, type SplitRowsCategory } from "@/components/SplitRows";
import { SubmitButton } from "@/components/SubmitButton";
import type { PayeeOption } from "@/lib/payees/queries";
import {
  buttonPrimary,
  checkbox,
  checkboxRow,
  field,
  input as inputClass,
  label as labelClass,
  select as selectClass,
} from "@/lib/ui";

export interface ExpenseFormAccount {
  id: string;
  name: string;
  type: string;
}

export function ExpenseForm({
  accounts,
  categories,
  payees,
  defaultDate,
  expenseAction,
  splitExpenseAction,
}: {
  accounts: ExpenseFormAccount[];
  categories: SplitRowsCategory[];
  payees: PayeeOption[];
  defaultDate: string;
  expenseAction: (formData: FormData) => void | Promise<void>;
  splitExpenseAction: (formData: FormData) => void | Promise<void>;
}) {
  const [isSplit, setIsSplit] = useState(false);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [splits, setSplits] = useState<SplitRowValue[]>([
    { categoryId: categories[0]?.id ?? "", amount: "" },
    { categoryId: categories[1]?.id ?? categories[0]?.id ?? "", amount: "" },
  ]);

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
    <form action={isSplit ? splitExpenseAction : expenseAction}>
      <div className={field}>
        <label htmlFor="accountId" className={labelClass}>
          Account
        </label>
        <select id="accountId" name="accountId" required className={selectClass}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
      </div>

      {categories.length >= 2 ? (
        <label className={checkboxRow}>
          <input
            type="checkbox"
            className={checkbox}
            checked={isSplit}
            onChange={(e) => setIsSplit(e.target.checked)}
          />
          Split into multiple categories
        </label>
      ) : null}

      {!isSplit ? (
        <div className={field}>
          <label htmlFor="categoryId" className={labelClass}>
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            className={selectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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

      {isSplit ? (
        <SplitRows
          categories={categories}
          splits={splits}
          remaining={remaining}
          onChange={updateSplit}
          onAdd={addSplitRow}
          onRemove={removeSplitRow}
        />
      ) : null}

      <div className={field}>
        <label htmlFor="date" className={labelClass}>
          Date
        </label>
        <input id="date" name="date" type="date" defaultValue={defaultDate} className={inputClass} />
      </div>
      <PayeeCombobox
        payees={payees}
        onSelectPayee={(payee) => {
          if (payee.lastCategoryId && categories.some((c) => c.id === payee.lastCategoryId)) {
            setCategoryId(payee.lastCategoryId);
          }
        }}
      />

      <SubmitButton
        className={buttonPrimary}
        disabled={isSplit && !isBalanced}
        pendingLabel="Recording…"
      >
        Record Expense
      </SubmitButton>
    </form>
  );
}
