// Ported from src/lib/ui.ts's currency() -- identical behavior, no shared
// package between the two apps.
export function currency(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
