// Local-calendar date helpers -- deliberately avoid Date#toISOString(),
// which converts through UTC and can shift the calendar day for anyone
// west or east of UTC. Mirrors the intent of the web dashboard's own
// currentMonthRange() (src/lib/dashboard/queries.ts), which uses
// Date.UTC for the same reason on the server; here everything stays in
// local-device calendar arithmetic instead since there's no server clock
// involved.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dateFrom: toDateString(start), dateTo: toDateString(end) };
}

// Ports src/app/(app)/reports/spending/page.tsx's shiftMonth exactly --
// month is 1-indexed (matches the API's year/month query params), delta
// can be negative, and the result rolls over/under into an adjacent year.
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
