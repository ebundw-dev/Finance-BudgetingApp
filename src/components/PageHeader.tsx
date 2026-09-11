import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel = "Back",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="text-text-secondary hover:text-accent mb-2 inline-block text-sm"
        >
          &larr; {backLabel}
        </Link>
      ) : null}
      {eyebrow ? (
        <p className="text-text-secondary mb-1 text-xs font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-text text-4xl leading-[1.05] font-medium tracking-tight italic sm:text-5xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-text-secondary mt-3 max-w-lg text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}
