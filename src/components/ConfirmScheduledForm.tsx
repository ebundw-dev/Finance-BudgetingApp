"use client";

import { useState } from "react";
import { confirmScheduledTransaction, skipScheduledTransaction } from "@/lib/scheduled/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, buttonSecondary, input as inputClass } from "@/lib/ui";

// Amount is editable right here since bill amounts vary -- confirming
// posts through the same accounting engine a manual entry would use (see
// confirmScheduledTransaction), skipping just advances the schedule
// without posting anything.
export function ConfirmScheduledForm({ id, defaultAmount }: { id: string; defaultAmount: string }) {
  const [amount, setAmount] = useState(defaultAmount);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={confirmScheduledTransaction} className="flex items-center gap-2">
        <input type="hidden" name="scheduledId" value={id} />
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} w-24 py-1.5 text-sm`}
        />
        <SubmitButton className={`${buttonPrimary} px-3 py-1.5 text-xs`} pendingLabel="Posting…">
          Confirm
        </SubmitButton>
      </form>
      <form action={skipScheduledTransaction}>
        <input type="hidden" name="scheduledId" value={id} />
        <SubmitButton className={`${buttonSecondary} px-3 py-1.5 text-xs`} pendingLabel="Skipping…">
          Skip
        </SubmitButton>
      </form>
    </div>
  );
}
