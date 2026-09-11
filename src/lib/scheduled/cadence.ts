// Pure date math for advancing a scheduled transaction's next_due_date --
// kept free of DB access, same rationale as allocationRules.ts and
// categories/targets.ts.

export type Cadence = "weekly" | "biweekly" | "monthly" | "yearly" | "custom_days";

// Adds `months` calendar months to a date, clamping the day-of-month to
// the last day of the target month instead of letting it overflow into
// the following month (the classic JS Date gotcha: Jan 31 + 1 month would
// otherwise land on Mar 3, not Feb 28). Used for both "monthly" (+1) and
// "yearly" (+12), so Feb 29 on a leap year correctly lands on Feb 28 the
// following (non-leap) year rather than rolling into March.
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const targetMonthIndex = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDayOfTargetMonth)));
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateString(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// intervalDays is only read for cadence "custom_days" -- required there
// (validated at the action layer), ignored otherwise.
export function computeNextDueDate(
  currentDueDate: string,
  cadence: Cadence,
  intervalDays: number | null
): string {
  const date = parseDateString(currentDueDate);

  switch (cadence) {
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case "monthly":
      return toDateString(addMonthsClamped(date, 1));
    case "yearly":
      return toDateString(addMonthsClamped(date, 12));
    case "custom_days":
      date.setUTCDate(date.getUTCDate() + (intervalDays && intervalDays > 0 ? intervalDays : 30));
      break;
  }

  return toDateString(date);
}

export function isDueBy(nextDueDate: string, referenceDate: string): boolean {
  return nextDueDate <= referenceDate;
}
