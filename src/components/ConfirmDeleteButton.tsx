"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonDanger } from "@/lib/ui";

// Two clicks instead of a native confirm() dialog: the first swaps the
// icon button for an explicit "Confirm delete" button (type="button", so
// it doesn't submit by accident), and only the second click actually
// submits the enclosing form. Must be rendered inside the <form
// action={...}> it's meant to submit.
export function ConfirmDeleteButton({
  label = "Delete",
  iconOnly = false,
}: {
  label?: string;
  iconOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={label}
        aria-label={label}
        className={
          iconOnly
            ? "text-text-secondary hover:text-danger hover:bg-danger/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
            : `${buttonDanger} px-3 py-1.5 text-xs`
        }
      >
        {iconOnly ? <Trash2 size={15} strokeWidth={2} /> : label}
      </button>
    );
  }

  return (
    <SubmitButton className={`${buttonDanger} px-3 py-1.5 text-xs`} pendingLabel="Deleting…">
      Confirm delete?
    </SubmitButton>
  );
}
