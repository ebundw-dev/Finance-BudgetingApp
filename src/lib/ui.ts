// Shared Tailwind class strings so every form/table across the app looks
// consistent without a full component library. Applied directly on native
// <input>/<select>/<button>/<table> elements.

export const input =
  "w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export const select = input;

export const label = "mb-1 block text-sm font-medium text-text-secondary";

export const field = "mb-4";

export const checkboxRow = "mb-3 flex items-center gap-2 text-sm text-text";
export const checkbox = "h-4 w-4 rounded border-border bg-base accent-accent";

export const buttonPrimary =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50";

export const buttonSecondary =
  "inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-50";

export const buttonDanger =
  "inline-flex items-center justify-center rounded-full border border-danger/30 bg-danger/10 px-5 py-2.5 text-sm font-medium text-danger hover:bg-danger/20 transition-colors";

export const link = "text-accent hover:text-accent-hover hover:underline";

export const table = "w-full border-collapse text-sm";
export const th = "border-b border-border px-4 py-3 text-left font-medium text-text-secondary";
export const td = "border-b border-border/60 px-4 py-3.5 text-text";

export const errorBanner = "mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger";
export const successBanner = "mb-4 rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success";

export function currency(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
