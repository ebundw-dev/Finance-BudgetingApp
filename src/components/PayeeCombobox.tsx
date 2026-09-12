"use client";

import { useState } from "react";
import { normalizePayee } from "@/lib/subscriptions/detect";
import type { PayeeOption } from "@/lib/payees/queries";
import { field, input as inputClass, label as labelClass } from "@/lib/ui";

const MAX_SUGGESTIONS = 8;

// Free-text payee input with a live-filtered dropdown of the user's
// existing payees, reusing the same normalization the subscription
// detector groups payees by (case/whitespace-insensitive, not exact-string)
// so "Netflix" and "netflix" surface as the same suggestion. The visible
// input's name stays "source" -- it's still the transaction's existing
// free-text payee/description field; the server resolves (and creates, if
// new) the payees row by normalized name on submit, so no hidden payeeId
// field is needed here. onSelectPayee fires both on an explicit dropdown
// pick and when the typed text already fully matches an existing payee, so
// the category can be auto-filled either way.
export function PayeeCombobox({
  payees,
  initialValue = "",
  onSelectPayee,
}: {
  payees: PayeeOption[];
  initialValue?: string;
  onSelectPayee?: (payee: PayeeOption) => void;
}) {
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);

  const normalizedQuery = normalizePayee(query);
  const suggestions = normalizedQuery
    ? payees
        .filter((p) => p.name.includes(normalizedQuery))
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function handleChange(value: string) {
    setQuery(value);
    setIsOpen(true);
    const exactMatch = payees.find((p) => p.name === normalizePayee(value));
    if (exactMatch) onSelectPayee?.(exactMatch);
  }

  function handleSelect(payee: PayeeOption) {
    setQuery(payee.name);
    setIsOpen(false);
    onSelectPayee?.(payee);
  }

  return (
    <div className={`${field} relative`}>
      <label htmlFor="source" className={labelClass}>
        Merchant / payee
      </label>
      <input
        id="source"
        name="source"
        type="text"
        autoComplete="off"
        className={inputClass}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />
      {isOpen && suggestions.length > 0 ? (
        <ul className="border-border bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-md border shadow-md">
          {suggestions.map((payee) => (
            <li key={payee.id}>
              <button
                type="button"
                // onMouseDown fires before the input's onBlur, so the click
                // registers before the dropdown would otherwise close.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(payee);
                }}
                className="hover:bg-surface-hover flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text"
              >
                <span>{payee.name}</span>
                <span className="text-text-muted text-xs">{payee.useCount}&times;</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
