# Handoff

Written for whoever (human or Claude) picks this up next. See `CLAUDE.md`
for the accounting rules (read that first, it's non-negotiable) and
`PROJECT_BRIEF.md` for the original product spec. `mobile/README.md` has
the mobile app's own setup/testing instructions in detail -- this file
just summarizes.

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
- `DATABASE_URL` -- Neon Postgres connection string
- `SESSION_SECRET` -- random string for signing the web login session cookie

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
typically -- see `mobile/README.md`) and `EXPO_PUBLIC_API_TOKEN` (issued
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
Plus confirm both Metro bundles compile -- start `npx expo start` in
`mobile/` and hit `http://localhost:<port>/index.ts.bundle?platform=ios&dev=true`
and `...platform=android&dev=true` directly (this is how it's been
verified all session, since there's no simulator/device in this
environment to run `expo start` interactively against).

## What's done

**Web app**: full-featured -- accounts, categories (with targets:
refill_up_to / set_aside_monthly / by_date), goals, debts, rule sets
(percentage-based Auto-Allocate), transactions (income/expense/split
expense/transfer/debt payment/category reallocation), scheduled
transactions, subscription detection, CSV import, payee tracking with
autocomplete, spending reports, a token-authenticated REST API for the
mobile app, and PWA support. All committed and pushed.

**Mobile app** (Expo/React Native, `mobile/`) -- built in phases, all
committed:
- Phase 2: Expo scaffold + EAS Build config (infrastructure proving)
- Phase 3: Dashboard tab (real data from `GET /api/dashboard`)
- Phase 4: Accounts + Transactions tabs (transactions: create-expense
  only at that point -- edit/delete/split added in Phase 8, below)
- Phase 5: Budget tab (Allocate, Goals, Debts, Rule Sets, Scheduled) +
  a real Settings screen
- Phase 6: Face ID / biometric app lock (`expo-local-authentication`)
- Phase 7: Create/edit forms for Accounts, Goals, Debts, Rule Sets
  (each needed new API routes too -- see "API layer conventions" below)
- **Phase 8 (now complete)**: closed the last two mobile-vs-web parity
  gaps.
  - **Categories**: mobile previously had zero Categories screen.
    Added `CategoriesListScreen` (a SectionList grouped by category
    group), `NewCategoryScreen`, `EditCategoryScreen` (name, the 4-way
    target-type selector via a new `CategoryTargetFields` RN port of
    `src/components/CategoryTargetFields.tsx`, priority, archive
    toggle), and a `CategoryRow` list component reusing
    `mobile/lib/categoryTargets.ts` for the funding-status cell. `GET
    /api/categories` now merges in `allocatedThisMonth` per category
    (additive; the web page fetches that separately and is untouched)
    so the funding-status cell can drive `set_aside_monthly`/`by_date`
    the same way web's `CategoryFundingCell` does. No group-create
    form and no delete button on mobile (matches the precedent every
    other mobile entity already set: edit-only, no delete; groups are
    created on web only).
  - **Transactions**: added `PATCH`/`DELETE /api/transactions/[id]`
    (wired to the engine's `updateExpense`/`updateSplitExpense`/
    `deleteTransaction`, added backend-side at the end of Phase 7's
    session -- see "Where things live" below), and on mobile: made
    `TransactionRowItem` tappable to a new `EditTransactionScreen`
    (editable in place for a plain expense; read-only-plus-delete for
    every other type, including split expenses -- split *editing*
    isn't exposed on mobile, only split *creation*, see below), and
    gave `NewExpenseScreen` a "Split into multiple categories" toggle
    mirroring web's `ExpenseForm`/`SplitRows` live "remaining to
    assign" UX (balanced tone `border-border`/`bg-surface`/`text-text`,
    unbalanced `border-danger/40`/`bg-danger/10`/`text-danger`,
    minimum 2 rows). `src/lib/transactions/queries.ts`'s `getTransaction`
    now also returns the raw `categoryId` (a new `TransactionDetail`
    type) since editing needs it to preselect the category picker --
    every other query in that file still only returns denormalized
    names, unaffected.

Root `npm test` (224 passing), `npm run lint`, and `npm run build` are
all clean as of the latest commit; mobile `npx tsc --noEmit` is clean;
both Metro bundles verified compiling.

## Decisions worth knowing (not obvious from the code)

- **"No web app changes" is interpreted narrowly-but-consistently**:
  every new `src/lib/api/*.ts` file (accounts, goals, debts, rules,
  categories, transactions) is a **separate copy** of the corresponding
  web Server Action's validation, not an extraction into a shared
  function. This means `src/lib/*/actions.ts` files are never touched,
  and the web app's pages/forms/behavior are byte-for-byte unchanged --
  at the cost of validation logic existing in two places that must be
  kept in sync by hand if the rules ever change. Comments at the top of
  each new `src/lib/api/*.ts` file say exactly which web action it
  mirrors.
- **Exception**: engine functions with no web equivalent to mirror
  (`updateExpense`, `deleteTransaction`) live in `engine.ts` itself, not
  a separate copy in `src/lib/api/`, because that's genuinely where
  this kind of business logic belongs (same file as every other
  `recordX` function), and because writing a safe, correctly-locked
  reversal requires the same private helpers (`lockAccount`/
  `lockCategory`/`lockMany`/`findReserveCategoryId`) that only exist
  inside that file. This is additive -- no existing exported function's
  behavior changed.
- **API routes that merge in extra fields beyond their underlying query**
  (e.g. `GET /api/categories` adding `allocatedThisMonth`, `GET
  /api/transactions/[id]` adding `categoryId`) do the merge in the route
  handler itself, not by changing the shared query function's return
  shape -- those query functions are also called by web pages/other
  callers that don't need the extra field.
- **Mobile Account editing deliberately excludes `currentBalance`** --
  there's no web account-edit page to mirror at all, so this was
  designed fresh; balances should only ever move through recorded
  transactions, never a direct field edit, or the transaction history
  stops being a complete audit trail.
- **A "debt" can only be created by creating an account with "track as
  debt" checked** -- there is no standalone debt-create form on web or
  mobile. Mobile's Debts tab "+" button opens the same `NewAccountScreen`
  the Accounts tab uses, just with that toggle pre-set.
- **Rule Set editing replaces every row** (delete then reinsert) rather
  than diffing, since rows have no stable per-row identity once
  categories/counts change between edits. No web equivalent exists for
  rule-set editing at all (web can only create-new or delete-whole-set).
- **No mobile entity has a delete button** except Transactions (Phase
  8) -- Goals/Debts/Rule Sets/Categories are all edit-only on mobile,
  matching whatever the web app itself allows (or, for Categories,
  matching the same precedent even though web *does* have a category
  delete -- its guard rails of zero balance + no history make archiving
  the realistic path anyway). Transactions are the exception because
  there was no delete capability *anywhere*, web included, before Phase
  8 added `deleteTransaction` specifically to give mobile one.
- **`src/lib/rules/queries.ts` and `src/lib/categories/queries.ts`-style
  files are marked `"server-only"`**, which throws unconditionally
  under plain `vitest` (no Next.js webpack pipeline to neutralize it
  outside real Next.js builds). Any new test or `src/lib/api/*.ts`
  module needing a duplicate-check or similar read against one of these
  should inline the query directly (see `src/lib/api/rules.ts`'s
  `createRuleSet` for the pattern) rather than importing the
  server-only file, or the test suite breaks. Route handlers
  (`src/app/api/**/route.ts`) run inside real Next.js and can import
  these files directly -- they're the exception, not tested with plain
  vitest.
- **Mobile always gates the whole app behind Face ID/Touch ID/passcode**
  (Phase 6) before rendering anything, including the connection-setup
  screen -- this is a pure client-side UI gate and never touches how the
  API token itself is stored (still `expo-secure-store`) or validated.
- **The mobile app's EAS project is already linked** (Phase 2 note,
  still true): `expo start` auto-linked it to the already-logged-in
  `eas-cli` session on this machine the first time it ran, so
  `app.config.ts`'s `extra.eas.projectId` is a real value, not the
  original placeholder.

## What's left

Nothing tracked as in-progress right now -- Phase 8 (the last planned
phase closing mobile-vs-web parity gaps) is done and committed. Ideas
for a next phase, not yet scoped:
- Mobile split-expense *editing* (only creation exists today --
  `EditTransactionScreen` is read-only-plus-delete for a split expense).
- An archived-categories view on mobile (web has one; mobile's
  `CategoriesListScreen` only shows active categories -- unarchiving
  still works via `EditCategoryScreen`'s toggle, it's just not
  reachable by browsing there since there's no archived list to tap
  into).
- A "create a new category group" form on mobile (web has one on
  `/categories/new`; mobile's `NewCategoryScreen` only picks among
  existing groups).

## Where things live

- Web pages: `src/app/(app)/*`; API routes: `src/app/api/*`
- Accounting engine (all money-moving logic): `src/lib/accounting/engine.ts`
- Per-entity web Server Actions: `src/lib/<entity>/actions.ts`
- Per-entity API-layer validation (mirrors the actions, doesn't call
  them): `src/lib/api/<entity>.ts`
- Mobile app: `mobile/` (separate npm project, separate `node_modules`)
  - Screens: `mobile/screens/*`; shared components: `mobile/components/*`
  - Navigation: `mobile/App.tsx` (tabs) -> `mobile/navigation/*Stack.tsx`
  - API client: `mobile/lib/api.ts` (hand-kept mirror of the web API's
    response shapes -- no shared package between the two apps)
