# Ledger — Project Context for Claude Code

This file is read automatically by Claude Code at the start of every session in this repo. Keep it accurate — it's the standing source of truth for the accounting logic, not just a description.

## What this is

A personal zero-based budgeting web app. Core philosophy: every dollar of available cash gets assigned a job. Built for irregular income (trading payouts, job income, business income, refunds). See `PROJECT_BRIEF.md` for the full phased build plan.

## Non-negotiable accounting rules

These rules are the whole point of the app. Any change to transaction logic, category balances, or account balances must preserve them. If a feature request would violate one of these, flag it before implementing.

**Core equation, must always hold exactly to the cent:**
```
Total Cash (sum of is_cash_account=true account balances)
= Sum of all category allocated_balances
+ Unallocated Cash
```

**Transaction types and their effects:**

| Type | Cash account | Category | Debt/CC account | Unallocated Cash |
|---|---|---|---|---|
| Income | + | — | — | + |
| Allocation | — | + | — | − |
| Expense (cash account) | − | − (spent) | — | — |
| Expense (credit card) | — | − (spent) | + (debt) | — |
| Debt payment | − | — | − | — |
| Transfer (cash↔cash) | −/+ | — | — | — |
| Category reallocation | — | −/+ | — | — |

**Key traps to avoid (these caused real bugs in earlier drafts of this spec):**
- A credit card purchase must NOT touch Unallocated Cash or any cash account balance. The category is "spoken for" at purchase time; cash only leaves the system when the bill is paid.
- Paying a credit card bill must NOT be counted as "spending" in monthly totals — the spending was already counted at purchase time. It's a debt payment only.
- Allocating money into a category, or moving it between categories, is never income or an expense.
- Never allow a category's allocated_balance to go negative, and never allow Unallocated Cash to go negative.
- All balance-affecting writes must happen inside a DB transaction.

## Stack

- Postgres via Neon (see README.md for connection setup)
- ORM: Drizzle (or Prisma — confirm choice at project start and keep consistent)
- Frontend: React
- Backend: Node/Express (or a full-stack framework if it simplifies auth+DB wiring — decide once and document here)

## Conventions

- Every table has a `user_id` even though this is single-user for now — keep the schema multi-user-ready.
- Run the accounting engine's unit tests before touching UI in any session where transaction logic changed.
- Don't visually or verbally mimic YNAB's specific terminology or UI.
