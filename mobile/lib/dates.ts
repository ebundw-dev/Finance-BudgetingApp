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
