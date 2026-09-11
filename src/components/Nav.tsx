"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  LayoutGrid,
  ArrowLeftRight,
  SlidersHorizontal,
  SplitSquareHorizontal,
  Flag,
  CreditCard,
  Calendar,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/allocate", label: "Allocate", icon: SlidersHorizontal },
  { href: "/rules", label: "Rule Sets", icon: SplitSquareHorizontal },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/monthly", label: "Monthly", icon: Calendar },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav({
  onSignOut,
  userEmail,
}: {
  onSignOut: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const initial = userEmail.trim().charAt(0).toUpperCase() || "?";

  return (
    <nav className="sidebar-dark border-border flex shrink-0 flex-col gap-1 border-b p-3 md:h-screen md:w-64 md:overflow-y-auto md:border-r md:border-b-0 md:p-5">
      <div className="text-text px-2 pt-1 pb-4 text-xl font-semibold tracking-tight">
        Ledger
      </div>
      <div className="flex flex-row flex-wrap gap-1 md:flex-col">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm no-underline transition-colors " +
                (active
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text")
              }
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="md:mt-auto md:pt-6">
        <div className="border-border/60 flex items-center gap-2.5 rounded-lg border bg-surface/60 p-2.5">
          <div className="bg-accent/20 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text">{userEmail || "Signed in"}</p>
            <p className="text-text-muted text-xs">Personal Ledger</p>
          </div>
          {onSignOut}
        </div>
      </div>
    </nav>
  );
}
