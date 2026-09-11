"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Shows a pending label and disables itself while its parent <form>'s
// action is in flight -- every mutation in this app is a Server Action
// that redirects on completion, so without this every submit looked
// unresponsive until the full page navigation landed.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  title,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      title={title}
      aria-label={title}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
