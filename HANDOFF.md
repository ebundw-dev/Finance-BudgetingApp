# Handoff

Written at the end of a long Claude Code session for whoever (human or
Claude) picks this up next. See `CLAUDE.md` for the accounting rules
(read that first, it's non-negotiable) and `PROJECT_BRIEF.md` for the
original product spec. `mobile/README.md` has the mobile app's own
setup/testing instructions in detail — this file just summarizes.

## How to run it

**Web app (Next.js):**
```
npm install
npm run dev        # http://localhost:3000
npm run lint
npm test           # vitest, hits the REAL dev DB inside rolled-back transactions
npm run build
```

**Required env vars** (`.env` at repo root, gitignored, not committed):
- `DATABASE_URL` — Neon Postgres connection string
- `SESSION_SECRET` — random string for signing the web login session cookie

**Create/reset the one user this app is built for** (single-user app):
```
# In .env, temporarily set:
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=whatever
npm run db:seed-user
# Remove ADMIN_EMAIL/ADMIN_PASSWORD from .env afterward -- they're only
# read once by this script, not used at runtime.
```

**Drizzle/DB migrations:**
```
npm run db:generate   # after changing src/db/schema.ts
npm run db:push        # apply to the Neon DB
npm run db:studio      # browse the DB
```

**Mobile app (Expo/React Native):**
```
cd mobile
npm install
npx expo start      # scan the QR with Expo Go on your phone
```
Needs `mobile/.env.local` (copy from `mobile/.env.example`) with
`EXPO_PUBLIC_API_BASE_URL` (an ngrok tunnel to your local `npm run dev`,
typically — see `mobile/README.md`) and `EXPO_PUBLIC_API_TOKEN` (issued
from the web app's Settings page, or `POST /api/auth/token`). The mobile
app is a *separate* npm project (`mobile/package.json`), not part of the
root install.

**Mobile gate before committing anything under `mobile/`:**
```
cd mobile
npx tsc --noEmit
cd ..
npm run lint          # lints the whole repo, mobile included
```
Plus confirm both Metro bundles compile — start `npx expo start` in
`mobile/` and hit `http://localhost:<port>/index.ts.bundle?platform=ios&dev=true`
and `...platform=android&dev=true` directly (this is how it's been
verified all session, since there's no simulator/device in this
environment to run `expo start` interactively against).

## What's done

**Web app**: full-featured — accounts, categories (with targets:
refill_up_to / set_aside_monthly / by_date), goals, debts, rule sets
(percentage-based Auto-Allocate), transactions (income/expense/split
expense/transfer/debt payment/category reallocation), scheduled
transactions, subscription detection, CSV import, payee tracking with
autocomplete, spending reports, a token-authenticated REST API for the
mobile app, and PWA support. All committed and pushed.

**Mobile app** (Expo/React Native, `mobile/`) — built in phases, all
committed and pushed through Phase 7:
- Phase 2: Expo scaffold + EAS Build config (infrastructure proving)
- Phase 3: Dashboard tab (real data from `GET /api/dashboard`)
- Phase 4: Accounts + Transactions tabs (transactions: create-expense
  only, no edit/delete/split yet — see below)
- Phase 5: Budget tab (Allocate, Goals, Debts, Rule Sets, Scheduled) +
  a real Settings screen
- Phase 6: Face ID / biometric app lock (`expo-local-authentication`)
- Phase 7: Create/edit forms for Accounts, Goals, Debts, Rule Sets
  (each needed new API routes too — see "API layer conventions" below)

**Phase 8 (in progress right now — see "Uncommitted work" below)**:
closing the two remaining mobile-vs-web parity gaps —
Categories CRUD (mobile had zero Categories screen) and finishing
Transactions (edit/delete/split-entry, previously create-plain-expense
only).

## Uncommitted work in the tree right now

As of this session ending, `git status` shows (nothing else pending —
everything before this is already pushed to `origin/main`):

- **Modified**: `src/lib/accounting/engine.ts`, `src/app/api/categories/route.ts`,
  `src/app/api/categories/[id]/route.ts`
- **New**: `src/lib/api/categories.ts` (+ `.test.ts`),
  `src/lib/accounting/updateExpense.test.ts`,
  `src/lib/accounting/deleteTransaction.test.ts`

This is the **backend half of Phase 8**, and it's complete and tested:

1. **Categories API** — `POST /api/categories`, `PATCH`/`DELETE
   /api/categories/[id]`, mirroring `src/lib/categories/actions.ts`'s
   `createCategory`/`updateCategory`/`deleteCategory` validation exactly
   (a separate copy in `src/lib/api/categories.ts`, not an extracted
   shared function — see "API layer conventions" below for why).
2. **Two new accounting-engine functions**, added to
   `src/lib/accounting/engine.ts` because no such capability existed
   anywhere (web included) to mirror:
   - `updateExpense` — edits a plain (non-split) expense's
     category/amount/date/source/notes. Account and type stay
     immutable. Uses the same "reverse old, apply new, net into one
     delta per category" technique the existing `updateSplitExpense`
     already used, generalized to a single category.
   - `deleteTransaction` — reverses *any* transaction type (expense,
     split expense, income, transfer, debt payment, category
     reallocation, allocation) and removes the row. No delete
     capability existed anywhere before this (web has none either).
     Dispatches on `type` and mirrors each `recordX` function's effect
     in reverse.
   Both are thoroughly tested against the real dev DB (16 new tests
   between the two `.test.ts` files, including credit-card reserve-
   category cases and "can this actually be reversed without going
   negative" failure cases) — root `npm test` is at 217 passing tests
   total (up from 158 at the start of this session).

**Not yet done** (the rest of Phase 8 — pick up here):
- `src/app/api/transactions/[id]/route.ts` needs `PATCH` (wired to
  `updateExpense` for a plain expense, `updateSplitExpense` — already
  existed — for a split one) and `DELETE` (wired to the new
  `deleteTransaction`). Neither exists yet; only `GET` is there today.
- Mobile: no Categories screen exists at all yet (list grouped by
  category group, create/edit forms with the 4-way target-type
  selector — None/Refill Up To/Set Aside Monthly/By Date — need to
  reuse `mobile/lib/categoryTargets.ts`, which is already a verbatim
  port of the web funding-status logic). Needs adding to
  `BudgetMenuScreen`'s `ITEMS` list and `BudgetStack`'s param list,
  following the exact List→Edit pattern already established for
  Goals/Debts/Rule Sets in Phase 7.
- Mobile: `TransactionRowItem` isn't tappable yet (no navigation to an
  edit screen); `TransactionsListScreen`/`NewExpenseScreen` need a
  split-entry toggle (mirroring web's `ExpenseForm`/`SplitRows` live
  "remaining to assign" UX — balanced tone `border-border bg-surface
  text-text`, unbalanced `border-danger/40 bg-danger/10 text-danger`,
  minimum 2 rows) and new `mobile/lib/api.ts` fetchers
  (`updateExpense`, `deleteTransaction`, a split-expense variant of
  `createExpense`).
- Root `npm run lint` / `npm run build` / `npm test` all pass as of
  this commit boundary — re-run them after finishing the routes above,
  before wiring up mobile.
- Commit split intended: Categories (API + mobile) as one commit,
  Transactions (API + mobile) as a separate one — matching how Phase 7
  committed each entity separately.

## Decisions worth knowing (not obvious from the code)

- **"No web app changes" is interpreted narrowly-but-consistently**:
  every new `src/lib/api/*.ts` file (accounts, goals, debts, rules,
  categories) is a **separate copy** of the corresponding web Server
  Action's validation, not an extraction into a shared function. This
  means `src/lib/*/actions.ts` files are never touched, and the web
  app's pages/forms/behavior are byte-for-byte unchanged — at the cost
  of validation logic existing in two places that must be kept in sync
  by hand if the rules ever change. Comments at the top of each new
  `src/lib/api/*.ts` file say exactly which web action it mirrors.
- **Exception**: the two new engine functions (`updateExpense`,
  `deleteTransaction`) live in `engine.ts` itself, not a separate copy
  in `src/lib/api/`, because that's genuinely where this kind of
  business logic belongs (same file as every other `recordX`
  function), and because writing a safe, correctly-locked reversal
  requires the same private helpers (`lockAccount`/`lockCategory`/
  `lockMany`/`findReserveCategoryId`) that only exist inside that file.
  This is additive — no existing exported function's behavior changed.
- **Mobile Account editing deliberately excludes `currentBalance`** —
  there's no web account-edit page to mirror at all, so this was
  designed fresh; balances should only ever move through recorded
  transactions, never a direct field edit, or the transaction history
  stops being a complete audit trail.
- **A "debt" can only be created by creating an account with "track as
  debt" checked** — there is no standalone debt-create form on web or
  mobile. Mobile's Debts tab "+" button opens the same `NewAccountScreen`
  the Accounts tab uses, just with that toggle pre-set.
- **Rule Set editing replaces every row** (delete then reinsert) rather
  than diffing, since rows have no stable per-row identity once
  categories/counts change between edits. No web equivalent exists for
  rule-set editing at all (web can only create-new or delete-whole-set).
- **`src/lib/rules/queries.ts` and `src/lib/categories/queries.ts`-style
  files are marked `"server-only"`**, which throws unconditionally
  under plain `vitest` (no Next.js webpack pipeline to neutralize it
  outside real Next.js builds). Any new test or `src/lib/api/*.ts`
  module needing a duplicate-check or similar read against one of these
  should inline the query directly (see `src/lib/api/rules.ts`'s
  `createRuleSet` for the pattern) rather than importing the
  server-only file, or the test suite breaks.
- **Mobile always gates the whole app behind Face ID/Touch ID/passcode**
  (Phase 6) before rendering anything, including the connection-setup
  screen — this is a pure client-side UI gate and never touches how the
  API token itself is stored (still `expo-secure-store`) or validated.
- **The mobile app's EAS project is already linked** (Phase 2 note,
  still true): `expo start` auto-linked it to the already-logged-in
  `eas-cli` session on this machine the first time it ran, so
  `app.config.ts`'s `extra.eas.projectId` is a real value, not the
  original placeholder.

## Where things live

- Web pages: `src/app/(app)/*`; API routes: `src/app/api/*`
- Accounting engine (all money-moving logic): `src/lib/accounting/engine.ts`
- Per-entity web Server Actions: `src/lib/<entity>/actions.ts`
- Per-entity API-layer validation (mirrors the actions, doesn't call
  them): `src/lib/api/<entity>.ts`
- Mobile app: `mobile/` (separate npm project, separate `node_modules`)
  - Screens: `mobile/screens/*`; shared components: `mobile/components/*`
  - Navigation: `mobile/App.tsx` (tabs) → `mobile/navigation/*Stack.tsx`
  - API client: `mobile/lib/api.ts` (hand-kept mirror of the web API's
    response shapes — no shared package between the two apps)
