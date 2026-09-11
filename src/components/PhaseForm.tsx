"use client";

import { useState, useTransition } from "react";
import { phaseEnum } from "@/db/schema";
import { updatePhase } from "@/app/(app)/actions";
import { buttonSecondary, select as selectClass } from "@/lib/ui";

// Deliberately NOT <form action={fn}>: React 19 resets that kind of form
// after every dispatch (native form.reset() semantics -- with no <option
// selected>, that lands on the first enum value, "STABILIZE", which is
// exactly the wrong phase this kept reverting to). A controlled <select>
// only sometimes wins that fight back -- confirmed flaky even with a
// useActionState-driven remount key. Calling the action directly from a
// plain onSubmit handler sidesteps the auto-reset mechanism entirely: the
// select's value is never touched by anything but the user's own onChange.
export function PhaseForm({ initialPhase }: { initialPhase: string }) {
  const [phase, setPhase] = useState(initialPhase);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updatePhase({ phase }, formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label htmlFor="phase" className="text-sm text-text-secondary">
        Phase
      </label>
      <select
        id="phase"
        name="phase"
        value={phase}
        onChange={(e) => setPhase(e.target.value)}
        className={`${selectClass} w-auto`}
      >
        {phaseEnum.enumValues.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button type="submit" className={buttonSecondary} disabled={pending} aria-busy={pending}>
        {pending ? "Updating…" : "Update"}
      </button>
    </form>
  );
}
