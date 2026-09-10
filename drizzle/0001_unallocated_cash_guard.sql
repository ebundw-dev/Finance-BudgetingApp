-- Enforces "Unallocated Cash must never go negative" at the database level.
-- Unallocated Cash is a derived value (Total Cash of is_cash_account=true
-- accounts, minus the sum of categories.allocated_balance) rather than a
-- stored column, so it can't carry a plain CHECK constraint. Instead: a
-- function that recomputes the aggregate for a user, wired to both tables
-- that feed it via DEFERRABLE INITIALLY DEFERRED constraint triggers, so
-- they evaluate once at COMMIT (after every row in the transaction has been
-- written) rather than after each individual row change. That avoids false
-- positives from a transiently "invalid" intermediate state -- e.g. a
-- category reallocation that increments the destination category before it
-- decrements the source -- while still refusing to let any transaction
-- commit a state where allocated balances exceed cash on hand, regardless
-- of which code path wrote it.

CREATE FUNCTION assert_unallocated_cash_non_negative() RETURNS trigger AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_total_cash numeric;
  v_total_allocated numeric;
BEGIN
  SELECT COALESCE(SUM(current_balance), 0) INTO v_total_cash
    FROM accounts
    WHERE user_id = v_user_id AND is_cash_account = true;

  SELECT COALESCE(SUM(allocated_balance), 0) INTO v_total_allocated
    FROM categories
    WHERE user_id = v_user_id;

  IF v_total_cash - v_total_allocated < 0 THEN
    RAISE EXCEPTION 'Unallocated cash would go negative for user % (cash=%, allocated=%)',
      v_user_id, v_total_cash, v_total_allocated
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER trg_accounts_unallocated_cash_guard
  AFTER INSERT OR UPDATE OF current_balance ON accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_unallocated_cash_non_negative();
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER trg_categories_unallocated_cash_guard
  AFTER INSERT OR UPDATE OF allocated_balance ON categories
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_unallocated_cash_non_negative();
