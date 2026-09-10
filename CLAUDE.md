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

"Category" below always means the user-visible spending/goal category the transaction is against. Debt payment and credit card expense *also* move a second, hidden category — see "The debt reserve category mechanic" immediately after this table; without it, the Unallocated Cash column here is not actually achievable (see that section for why).

| Type | Cash account | Category | Debt/CC account | Unallocated Cash |
|---|---|---|---|---|
| Income | + | — | — | + |
| Allocation | — | + | — | − |
| Expense (cash account) | − | − (spent) | — | — |
| Expense (credit card) | — | − (spent) | + (debt) | — |
| Debt payment | − | — | − | — |
| Transfer (cash↔cash) | −/+ | — | — | — |
| Category reallocation | — | −/+ | — | — |

**The debt reserve category mechanic (required for the table above to actually balance):**

Unallocated Cash is a *derived* value, not a stored column: `Total Cash − Sum(all category.allocated_balance)`. That means Sum(category balances) and Total Cash must move together, in lockstep, on every transaction type — otherwise Unallocated Cash moves too, whether or not the table above says it should.

Expense (credit card) and Debt payment are the two rows where naively following the table breaks this: a credit card purchase decreases a spending category's balance while Total Cash doesn't move at all, which forces Unallocated Cash to rise unless something else in category-space absorbs it. The fix: **every debt has exactly one dedicated, non-user-facing category (`debts.category_id` — e.g. "Credit Card 1" in the DEBT group) that tracks cash reserved to pay it off.**

- **Expense (credit card):** the spending category goes down by the purchase amount (as shown above), and the debt's reserve category goes up by the *same* amount. Net change to Sum(category balances) is zero, so Unallocated Cash truly doesn't move, and Total Cash doesn't either — consistent with the table.
- **Debt payment:** the debt's reserve category goes down by the payment amount, in place of "no category effect." Cash and the reserve category both drop by the same amount, so Unallocated Cash doesn't move. The user-visible spending category from the original purchase is never touched again here — that's why paying the bill is never "spending": the spend was already counted when the reserve category absorbed it at purchase time.

An emergent invariant, worth checking in tests: as long as every credit card charge and every debt payment goes through this mechanic, a debt's reserve category balance always equals its account's current debt balance.

**Key traps to avoid (these caused real bugs in earlier drafts of this spec):**
- A credit card purchase must NOT touch Unallocated Cash or any cash account balance. The category is "spoken for" at purchase time; cash only leaves the system when the bill is paid.
- Paying a credit card bill must NOT be counted as "spending" in monthly totals — the spending was already counted at purchase time. It's a debt payment only.
- Allocating money into a category, or moving it between categories, is never income or an expense.
- Never allow a category's allocated_balance to go negative, and never allow Unallocated Cash to go negative.
- All balance-affecting writes must happen inside a DB transaction.
- Don't reintroduce a credit card expense or debt payment that skips the debt reserve category — it will pass a casual reading of the table above while silently breaking the core equation. See "The debt reserve category mechanic."

## Stack

- Postgres via Neon (see README.md for connection setup)
- ORM: Drizzle, via `drizzle-orm/neon-serverless` (the websocket `Pool` driver, not `neon-http`) — the accounting engine needs real interactive transactions (`SELECT ... FOR UPDATE` followed by a conditional write), which the stateless HTTP driver can't do
- Framework: Next.js (App Router), frontend + API routes in one app
- Auth: single-user password gate (session cookie), not a third-party provider — this is a single-user app for now

## Conventions

- Every table has a `user_id` even though this is single-user for now — keep the schema multi-user-ready.
- Run the accounting engine's unit tests (`npm test`) before touching UI in any session where transaction logic changed. Tests live alongside the code in `src/lib/accounting/*.test.ts` and run against the real Neon dev DB inside a transaction that's always rolled back (see `src/lib/accounting/testing.ts`) — they exercise the real DB-level constraints/triggers, not a mock.
- The core equation and "never negative" rules are enforced at two layers, both required: the service layer (`src/lib/accounting/engine.ts`) does pre-flight checks for good error messages, and the database is the actual source of truth — `CHECK` constraints on `categories.allocated_balance >= 0` / `transactions.amount > 0`, plus a `DEFERRABLE INITIALLY DEFERRED` constraint trigger (`drizzle/0001_unallocated_cash_guard.sql`) that refuses any transaction that would leave Unallocated Cash negative, evaluated at COMMIT regardless of which code path wrote the data.
- Don't visually or verbally mimic YNAB's specific terminology or UI.
