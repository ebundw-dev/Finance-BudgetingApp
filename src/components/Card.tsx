import type { LucideIcon } from "lucide-react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(30,42,40,0.04),0_1px_8px_rgba(30,42,40,0.05)] ${padded ? "p-7" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export type StatTone = "default" | "success" | "danger" | "accent" | "warning" | "info";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-text",
  success: "text-success",
  danger: "text-danger",
  accent: "text-accent",
  warning: "text-warning",
  info: "text-info",
};

const TONE_BADGE: Record<StatTone, string> = {
  default: "bg-text-secondary/10 text-text-secondary",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  accent: "bg-accent/12 text-accent",
  warning: "bg-warning/12 text-warning",
  info: "bg-info/12 text-info",
};

export function StatCard({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: StatTone;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="text-text-secondary text-xs font-medium tracking-wide uppercase">
          {label}
        </div>
        {Icon ? (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_BADGE[tone]}`}>
            <Icon size={17} strokeWidth={2} />
          </div>
        ) : null}
      </div>
      <div className={`mt-3 text-3xl font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
    </Card>
  );
}
