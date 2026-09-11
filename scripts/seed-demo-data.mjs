// Seeds a realistic multi-month demo dataset into a DEDICATED demo user
// (never the real admin account) -- PROJECT_BRIEF.md Phase 8. Exercises
// every transaction type, 3 debts at varying payoff %, mixed-source
// income, and goals at varying completion, across two closed months
// (July, August) plus a partial, unclosed current month (September) to
// also demonstrate the live "current month, not yet snapshotted" state
// from Phase 7.
//
// State (account/category balances) is tracked in JS as each operation is
// applied, then written to the DB in the same order -- so the numbers are
// correct by construction rather than hand-calculated. Everything after
// the reset runs inside ONE real database transaction (via the
// neon-serverless Pool driver, not the auto-committing neon() HTTP
// client), so the deferred "unallocated cash never negative" trigger
// (drizzle/0001_unallocated_cash_guard.sql) evaluates once at COMMIT
// against the final state -- not after every individual UPDATE, which
// would false-positive on any operation whose two writes (e.g. a debt
// payment's cash decrease and reserve-category decrease) must be atomic
// together.
import "dotenv/config";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { neon, Pool } from "@neondatabase/serverless";
import { sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

const DEMO_EMAIL = "demo@ledger.local";
const DEMO_PASSWORD = "DemoPass123!";

// ---- Reset (plain auto-committing client -- DELETEs aren't covered by
// the balance-guard trigger, so no transaction is needed here) ----
const resetClient = neon(process.env.DATABASE_URL);
const [existing] = await resetClient`select id from users where email = ${DEMO_EMAIL}`;
if (existing) {
  const uid = existing.id;
  const monthRows = await resetClient`select id from months where user_id = ${uid}`;
  for (const m of monthRows) {
    await resetClient`delete from month_category_snapshots where month_id = ${m.id}`;
  }
  await resetClient`delete from months where user_id = ${uid}`;
  await resetClient`delete from transactions where user_id = ${uid}`;
  await resetClient`delete from goals where user_id = ${uid}`;
  await resetClient`delete from allocation_rules where user_id = ${uid}`;
  await resetClient`delete from debts where user_id = ${uid}`;
  await resetClient`delete from categories where user_id = ${uid}`;
  await resetClient`delete from category_groups where user_id = ${uid}`;
  await resetClient`delete from accounts where user_id = ${uid}`;
  await resetClient`delete from users where id = ${uid}`;
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(DEMO_PASSWORD, salt, 64).toString("hex");
const [user] = await resetClient`
  insert into users (id, email, password_hash, phase)
  values (${randomUUID()}, ${DEMO_EMAIL}, ${salt + ":" + hash}, 'BUILD')
  returning id
`;
const userId = user.id;

// ---- Everything else: one real transaction ----
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const summary = await db.transaction(async (tx) => {
  const q = async (strings, ...values) => (await tx.execute(drizzleSql(strings, ...values))).rows;

  const ids = {};

  async function createAccount(key, name, type, isCash, startingBalance) {
    const [row] = await q`
      insert into accounts (id, user_id, name, type, is_cash_account, current_balance)
      values (${randomUUID()}, ${userId}, ${name}, ${type}, ${isCash}, ${startingBalance})
      returning id
    `;
    ids[key] = row.id;
  }

  await createAccount("checking", "Checking", "checking", true, "0");
  await createAccount("savings", "Savings", "savings", true, "0");
  await createAccount("visa", "Visa", "credit_card", false, "0");
  await createAccount("storeCard", "Store Card", "credit_card", false, "0");
  // Pre-existing loan from before using the app -- debt exists, but no
  // cash has been reserved against it yet (a legitimate starting state;
  // see CLAUDE.md's debt reserve category mechanic notes).
  await createAccount("studentLoan", "Student Loan", "other", false, "3000.00");

  const groupIds = {};
  async function createGroup(key, name, sortOrder) {
    const [row] = await q`
      insert into category_groups (id, user_id, name, sort_order)
      values (${randomUUID()}, ${userId}, ${name}, ${sortOrder})
      returning id
    `;
    groupIds[key] = row.id;
  }
  await createGroup("essentials", "ESSENTIALS", 0);
  await createGroup("debt", "DEBT", 1);
  await createGroup("stability", "STABILITY", 2);
  await createGroup("freedom", "FREEDOM", 3);
  await createGroup("life", "LIFE", 4);

  async function createCategory(key, groupKey, name, categoryType, opts = {}) {
    const [row] = await q`
      insert into categories (id, user_id, group_id, name, category_type, target_amount, priority, allocated_balance, sort_order)
      values (${randomUUID()}, ${userId}, ${groupIds[groupKey]}, ${name}, ${categoryType}, ${opts.target ?? null}, ${opts.priority ?? null}, '0', ${opts.sortOrder ?? 0})
      returning id
    `;
    ids[key] = row.id;
  }

  await createCategory("rent", "essentials", "Rent/household", "spending");
  await createCategory("food", "essentials", "Food", "spending");
  await createCategory("gas", "essentials", "Gas", "spending");
  await createCategory("phone", "essentials", "Phone", "spending");
  await createCategory("insurance", "essentials", "Insurance", "spending");
  await createCategory("subscriptions", "essentials", "Subscriptions", "spending");
  await createCategory("otherBills", "essentials", "Other bills", "spending");

  await createCategory("visaReserve", "debt", "Visa Reserve", "spending", { priority: "P1" });
  await createCategory("storeCardReserve", "debt", "Store Card Reserve", "spending", { priority: "P1" });
  await createCategory("studentLoanReserve", "debt", "Student Loan Reserve", "spending", { priority: "P1" });

  await createCategory("emergencyFund", "stability", "Emergency Fund", "goal", { target: "3000.00", priority: "P1" });
  await createCategory("generalCashReserve", "stability", "General Cash Reserve", "goal");

  await createCategory("carFund", "freedom", "Car Fund", "goal", { target: "8000.00", priority: "P2" });
  await createCategory("moveOutFund", "freedom", "Move-Out Fund", "goal", { target: "5000.00", priority: "P2" });
  await createCategory("investments", "freedom", "Investments", "goal", { priority: "P3" });

  await createCategory("travel", "life", "Travel", "spending");
  await createCategory("datesSocial", "life", "Dates/Social", "spending");
  await createCategory("entertainment", "life", "Entertainment", "spending");
  await createCategory("shopping", "life", "Shopping", "spending");
  await createCategory("miscellaneous", "life", "Miscellaneous", "spending");

  async function createDebt(accountKey, categoryKey, startingBalance, minimumPayment, apr, targetPayoffDate) {
    await q`
      insert into debts (id, user_id, account_id, category_id, starting_balance, minimum_payment, apr, target_payoff_date)
      values (${randomUUID()}, ${userId}, ${ids[accountKey]}, ${ids[categoryKey]}, ${startingBalance}, ${minimumPayment}, ${apr}, ${targetPayoffDate})
    `;
  }
  await createDebt("visa", "visaReserve", "0.00", "35.00", "24.99", null);
  await createDebt("storeCard", "storeCardReserve", "0.00", "25.00", "26.99", null);
  await createDebt("studentLoan", "studentLoanReserve", "3000.00", "150.00", "5.50", "2029-01-01");

  const state = {
    accounts: { checking: 0, savings: 0, visa: 0, storeCard: 0, studentLoan: 3000 },
    categories: Object.fromEntries(
      [
        "rent", "food", "gas", "phone", "insurance", "subscriptions", "otherBills",
        "visaReserve", "storeCardReserve", "studentLoanReserve",
        "emergencyFund", "generalCashReserve", "carFund", "moveOutFund", "investments",
        "travel", "datesSocial", "entertainment", "shopping", "miscellaneous",
      ].map((k) => [k, 0])
    ),
  };
  const CASH_ACCOUNTS = new Set(["checking", "savings"]);
  const DEBT_RESERVE = { visa: "visaReserve", storeCard: "storeCardReserve", studentLoan: "studentLoanReserve" };

  async function insertTxn(fields) {
    await q`
      insert into transactions (id, user_id, type, account_id, related_account_id, category_id, related_category_id, amount, date, source, notes)
      values (
        ${randomUUID()}, ${userId}, ${fields.type},
        ${fields.accountId ?? null}, ${fields.relatedAccountId ?? null},
        ${fields.categoryId ?? null}, ${fields.relatedCategoryId ?? null},
        ${fields.amount}, ${fields.date}, ${fields.source ?? null}, ${fields.notes ?? null}
      )
    `;
  }
  async function setAccountBalance(key) {
    await q`update accounts set current_balance = ${state.accounts[key].toFixed(2)} where id = ${ids[key]}`;
  }
  async function setCategoryBalance(key) {
    await q`update categories set allocated_balance = ${state.categories[key].toFixed(2)} where id = ${ids[key]}`;
  }

  async function income(accountKey, amount, date, source) {
    state.accounts[accountKey] += amount;
    await insertTxn({ type: "income", accountId: ids[accountKey], amount: amount.toFixed(2), date, source });
    await setAccountBalance(accountKey);
  }
  async function allocate(categoryKey, amount, date) {
    state.categories[categoryKey] += amount;
    await insertTxn({ type: "allocation", categoryId: ids[categoryKey], amount: amount.toFixed(2), date });
    await setCategoryBalance(categoryKey);
  }
  async function cashExpense(accountKey, categoryKey, amount, date, source) {
    state.accounts[accountKey] -= amount;
    state.categories[categoryKey] -= amount;
    await insertTxn({
      type: "expense", accountId: ids[accountKey], categoryId: ids[categoryKey],
      amount: amount.toFixed(2), date, source,
    });
    await setAccountBalance(accountKey);
    await setCategoryBalance(categoryKey);
  }
  async function ccExpense(cardKey, categoryKey, amount, date, source) {
    const reserveKey = DEBT_RESERVE[cardKey];
    state.accounts[cardKey] += amount;
    state.categories[categoryKey] -= amount;
    state.categories[reserveKey] += amount;
    await insertTxn({
      type: "expense", accountId: ids[cardKey], categoryId: ids[categoryKey],
      relatedCategoryId: ids[reserveKey], amount: amount.toFixed(2), date, source,
    });
    await setAccountBalance(cardKey);
    await setCategoryBalance(categoryKey);
    await setCategoryBalance(reserveKey);
  }
  async function debtPayment(fromAccountKey, debtKey, amount, date) {
    const reserveKey = DEBT_RESERVE[debtKey];
    state.accounts[fromAccountKey] -= amount;
    state.accounts[debtKey] -= amount;
    state.categories[reserveKey] -= amount;
    await insertTxn({
      type: "debt_payment", accountId: ids[fromAccountKey], relatedAccountId: ids[debtKey],
      categoryId: ids[reserveKey], amount: amount.toFixed(2), date,
    });
    await setAccountBalance(fromAccountKey);
    await setAccountBalance(debtKey);
    await setCategoryBalance(reserveKey);
  }
  async function transfer(fromKey, toKey, amount, date) {
    state.accounts[fromKey] -= amount;
    state.accounts[toKey] += amount;
    await insertTxn({
      type: "transfer", accountId: ids[fromKey], relatedAccountId: ids[toKey],
      amount: amount.toFixed(2), date,
    });
    await setAccountBalance(fromKey);
    await setAccountBalance(toKey);
  }
  async function reallocate(fromKey, toKey, amount, date) {
    state.categories[fromKey] -= amount;
    state.categories[toKey] += amount;
    await insertTxn({
      type: "category_reallocation", categoryId: ids[fromKey], relatedCategoryId: ids[toKey],
      amount: amount.toFixed(2), date,
    });
    await setCategoryBalance(fromKey);
    await setCategoryBalance(toKey);
  }

  function totalCash() {
    return Object.entries(state.accounts)
      .filter(([k]) => CASH_ACCOUNTS.has(k))
      .reduce((sum, [, v]) => sum + v, 0);
  }
  function totalDebt() {
    return state.accounts.visa + state.accounts.storeCard + state.accounts.studentLoan;
  }
  function totalAllocated() {
    return Object.values(state.categories).reduce((sum, v) => sum + v, 0);
  }
  async function snapshotMonth(year, month) {
    const cash = totalCash();
    const debt = totalDebt();
    const unallocated = cash - totalAllocated();
    const [row] = await q`
      insert into months (id, user_id, year, month, unallocated_cash_snapshot, total_cash_snapshot, total_debt_snapshot)
      values (${randomUUID()}, ${userId}, ${year}, ${month}, ${unallocated.toFixed(2)}, ${cash.toFixed(2)}, ${debt.toFixed(2)})
      returning id
    `;
    const goalKeys = ["emergencyFund", "generalCashReserve", "carFund", "moveOutFund", "investments"];
    for (const key of goalKeys) {
      await q`
        insert into month_category_snapshots (id, month_id, category_id, allocated_balance)
        values (${randomUUID()}, ${row.id}, ${ids[key]}, ${state.categories[key].toFixed(2)})
      `;
    }
  }

  // ============================== JULY ==============================
  await income("checking", 2400, "2026-07-01", "Job Paycheck");
  await income("checking", 600, "2026-07-03", "Trading Payout");

  await allocate("rent", 900, "2026-07-01");
  await allocate("food", 400, "2026-07-01");
  await allocate("gas", 150, "2026-07-01");
  await allocate("emergencyFund", 500, "2026-07-01");
  await allocate("carFund", 300, "2026-07-01");
  await allocate("studentLoanReserve", 200, "2026-07-01");
  await allocate("travel", 150, "2026-07-01");
  await allocate("entertainment", 200, "2026-07-01");

  await cashExpense("checking", "food", 250, "2026-07-05", "Grocery Store");
  await cashExpense("checking", "gas", 120, "2026-07-06", "Gas Station");
  await ccExpense("visa", "entertainment", 180, "2026-07-10", "Concert Tickets");
  await ccExpense("storeCard", "travel", 90, "2026-07-14", "Travel Gear");
  await debtPayment("checking", "studentLoan", 200, "2026-07-20");
  await transfer("checking", "savings", 500, "2026-07-21");
  await reallocate("rent", "emergencyFund", 100, "2026-07-25");

  await snapshotMonth(2026, 7);

  // ============================= AUGUST ==============================
  await income("checking", 2400, "2026-08-01", "Job Paycheck");
  await income("checking", 800, "2026-08-04", "Freelance Work");

  await allocate("rent", 900, "2026-08-01");
  await allocate("food", 400, "2026-08-01");
  await allocate("gas", 150, "2026-08-01");
  await allocate("emergencyFund", 400, "2026-08-01");
  await allocate("carFund", 400, "2026-08-01");
  await allocate("moveOutFund", 200, "2026-08-01");
  await allocate("visaReserve", 150, "2026-08-01");
  await allocate("storeCardReserve", 100, "2026-08-01");
  await allocate("studentLoanReserve", 150, "2026-08-01");
  await allocate("travel", 50, "2026-08-01");
  await allocate("entertainment", 100, "2026-08-01");
  await allocate("shopping", 250, "2026-08-01");

  await cashExpense("checking", "food", 300, "2026-08-06", "Grocery Store");
  await cashExpense("checking", "rent", 900, "2026-08-07", "Landlord");
  await ccExpense("visa", "shopping", 220, "2026-08-12", "New Clothes");
  await ccExpense("storeCard", "entertainment", 80, "2026-08-15", "Movie Night");
  await debtPayment("checking", "visa", 400, "2026-08-20");
  await debtPayment("checking", "storeCard", 100, "2026-08-21");
  await debtPayment("checking", "studentLoan", 150, "2026-08-22");
  await transfer("checking", "savings", 300, "2026-08-25");

  await snapshotMonth(2026, 8);

  // ==================== SEPTEMBER (current, partial) ====================
  // Left un-snapshotted deliberately, to demonstrate the "current month,
  // not yet closed" state from the monthly view (Phase 7).
  await income("checking", 2400, "2026-09-01", "Job Paycheck");
  await allocate("rent", 900, "2026-09-01");
  await allocate("food", 400, "2026-09-01");
  await allocate("emergencyFund", 300, "2026-09-01");
  await allocate("carFund", 300, "2026-09-01");
  await allocate("datesSocial", 100, "2026-09-01");
  await cashExpense("checking", "food", 140, "2026-09-05", "Grocery Store");
  await ccExpense("visa", "datesSocial", 60, "2026-09-07", "Dinner Out");

  async function createGoal(name, targetAmount, targetDate, categoryKey) {
    await q`
      insert into goals (id, user_id, category_id, name, target_amount, target_date)
      values (${randomUUID()}, ${userId}, ${categoryKey ? ids[categoryKey] : null}, ${name}, ${targetAmount}, ${targetDate})
    `;
  }
  await createGoal("Emergency Fund Goal", "3000.00", null, "emergencyFund");
  await createGoal("Buy a Car", "8000.00", "2027-06-01", "carFund");
  await createGoal("Move Out", "5000.00", "2027-12-01", "moveOutFund");
  await createGoal("New Laptop", "1500.00", "2026-12-01", null);

  return {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    finalChecking: state.accounts.checking.toFixed(2),
    finalSavings: state.accounts.savings.toFixed(2),
    finalTotalCash: totalCash().toFixed(2),
    finalTotalDebt: totalDebt().toFixed(2),
    finalUnallocated: (totalCash() - totalAllocated()).toFixed(2),
    visaOwed: state.accounts.visa.toFixed(2),
    storeCardOwed: state.accounts.storeCard.toFixed(2),
    studentLoanOwed: state.accounts.studentLoan.toFixed(2),
  };
});

console.log(JSON.stringify(summary, null, 2));
await pool.end();
