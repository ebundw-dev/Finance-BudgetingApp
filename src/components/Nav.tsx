"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/transactions", label: "Transactions" },
  { href: "/allocate", label: "Allocate" },
  { href: "/rules", label: "Rule Sets" },
  { href: "/goals", label: "Goals" },
  { href: "/debts", label: "Debts" },
  { href: "/monthly", label: "Monthly" },
  { href: "/progress", label: "Progress" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav({ onSignOut }: { onSignOut: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-surface flex shrink-0 flex-col gap-1 border-b p-3 md:h-screen md:w-56 md:overflow-y-auto md:border-r md:border-b-0 md:p-4">
      <div className="text-text px-2 pt-1 pb-3 text-lg font-semibold tracking-tight">
        Ledger
      </div>
      <div className="flex flex-row flex-wrap gap-1 md:flex-col">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                "rounded-md px-2 py-1.5 text-sm no-underline transition-colors " +
                (active
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text")
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="md:mt-auto md:pt-4">{onSignOut}</div>
    </nav>
  );
}
