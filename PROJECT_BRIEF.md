# Ledger — Project Brief

A personal financial command-center web app: zero-based budgeting for irregular income. Every dollar of available cash gets assigned a job — bills, debt payoff, emergency reserve, car fund, move-out fund, investing, travel, social spending, misc.

For the accounting rules this app must never violate, see `CLAUDE.md` — read that first, every session.

## Priorities (current phase: STABILIZE)

Objectives: protect cash, destroy high-interest debt, build reserves, avoid lifestyle inflation, create financial optionality. Store phase as a user setting (`STABILIZE` / `BUILD` / `EXPAND` / `FREEDOM`) — don't overbuild the phase system, just make it changeable later.

## Data model (confirm/refine, then build)

- `users`
- `accounts` — name, type (checking/savings/cash/credit_card/investment/other), current_balance, is_cash_account
- `category_groups` — name, sort_order
- `categories` — group_id, name, category_type (spending/goal), priority (P1–P4), target_amount, allocated_balance
- `transactions` — account_id, category_id (nullable), type (income/expense/transfer/debt_payment), amount, date, source/merchant, notes
- `debts` — account_id, starting_balance, current_balance, minimum_payment, apr, target_payoff_date
- `goals` — category_id (nullable), name, target_amount, target_date
- `allocation_rules` — rule_name, category_id, percentage
- `months` — year, month, unallocated_cash_snapshot (for historical/progress views)

## Default seed categories

- **ESSENTIALS**: Rent/household, Food, Gas, Phone, Insurance, Subscriptions, Other bills
- **DEBT**: Credit Card 1, Credit Card 2, Collections, Other Debt
- **STABILITY**: Emergency Fund, General Cash Reserve
- **FREEDOM**: Car Fund, Move-Out Fund, Investments
- **LIFE**: Travel, Dates/Social, Entertainment, Shopping, Miscellaneous

## Build order

1. **Data model** — finalize schema, get it migrated in Neon.
2. **Accounting engine + unit tests** — implement all 7 transaction rules from CLAUDE.md, write tests for each before any UI exists. Do not proceed until these pass.
3. **Auth + persistence** — single user, but every table scoped by `user_id`.
4. **Dashboard** — Total Cash, Unallocated Cash, Total Debt, Net Financial Position, Emergency/Car/Move-Out Fund progress, Investments (earmarked), Income/Spending/Debt-Paid this month, Current Phase banner.
5. **Income entry, transactions, allocation screen** — including Auto-Allocate (percentage rules, remainder absorbed by last category so it always nets to $0) and Quick Payout Allocation (dashboard button → amount → straight to allocation screen pre-loaded against priority buckets: Debt, Emergency Cash, Car, Move-Out, Invest, Life).
6. **Goals + debt tracking** — progress bars, "eliminated" stat (started − current, and %).
7. **Monthly view + progress page** — month switcher with rollover (spending categories carry forward unspent balance; goal categories just accumulate), and a progress page with simple charts: net position, cash, debt, car fund, emergency fund over time, plus cumulative income/debt-paid/savings.
8. **Seed realistic demo data** — a few months of mixed-source income, populated categories, 2–3 debts at varying payoff %, transactions across all four types, goals at varying completion.
9. **Re-test accounting flows end-to-end** — overspending a category, over-allocating past Unallocated Cash, a credit card purchase followed by partial payment, category-to-category reallocation, month-boundary rollover.
10. **UI polish** — only after 1–9 are verified correct.

## Design direction

Dark mode default, modern financial command-center feel — not corporate banking, not childish, not overly colorful. Clean typography, dashboard cards, subtle progress bars, fast/optimistic UI especially on the allocation screen. Desktop-first, responsive. Original terminology throughout — no YNAB-style phrasing or layout.

## Acceptance criteria

- Core equation holds exactly to the cent at every point in the app.
- No UI path can allocate more than Unallocated Cash or spend a category below $0.
- Credit card purchases never touch Unallocated Cash or cash balances at purchase time.
- Paying a credit card bill is never counted as "spending" in monthly totals.
- Transfers never affect income/spending/category totals.
- Auto-Allocate always sums to exactly the amount available.
- Rollover carries forward unspent category balances automatically at month boundaries.

## Edge cases to handle explicitly

- $0 or negative allocation attempts — reject with a clear message.
- Deleting a category with a nonzero balance — require reallocation first, or return the balance to Unallocated Cash with confirmation.
- Deleting an account with a nonzero balance or linked transactions — block or require explicit confirmation.
- Rapid concurrent transactions against the same category — wrap balance writes in DB transactions to avoid race conditions.
- Switching a category's type (spending ↔ goal) after transactions exist against it — decide and document the behavior.
- Negative/overdrawn cash account balances — decide how this is displayed without breaking the core equation.
