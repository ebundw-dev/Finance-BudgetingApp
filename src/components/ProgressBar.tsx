export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const over = percent > 100;
  return (
    <div className="bg-border h-4 w-full overflow-hidden rounded-full shadow-inner">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-warning" : "bg-accent"}`}
        style={{ width: `${Math.max(clamped, clamped > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}
