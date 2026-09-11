export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const over = percent > 100;
  return (
    <div className="bg-base h-2 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-warning" : "bg-accent"}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
