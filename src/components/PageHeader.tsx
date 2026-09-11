import Link from "next/link";

export function PageHeader({
  title,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backHref ? (
        <Link href={backHref} className="text-text-secondary hover:text-accent text-sm">
          &larr; {backLabel}
        </Link>
      ) : null}
      <h1 className="text-text mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}
