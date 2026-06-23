-- ═══════════════════════════════════════════════════════════════════════
-- GM bank-balance lockdown (governance decision: "Option B").
-- General Manager is NOT finance-trusted. Remove general_manager from the
-- bank_accounts / account_transactions SELECT policies so a GM cannot read
-- bank balances or the bank ledger at the RLS layer. The AI Role Brief already
-- redacts these for GM/EP — this makes that a real control instead of cosmetic,
-- so RLS (the source of truth) and the brief now agree.
--
-- Reads are brought in line with the existing write policies: founder +
-- accountant only, via is_finance(). No app page that queries bank_accounts is
-- reachable by a GM (all redirect non-finance), so this is non-breaking.
-- Supersedes the GM-inclusive policies from migration-v3-upgrade.sql. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- bank_accounts: SELECT → founder + accountant only
DROP POLICY IF EXISTS "bank_accounts_read_finance_gm" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_read_finance" ON bank_accounts;
CREATE POLICY "bank_accounts_read_finance" ON bank_accounts
  FOR SELECT TO authenticated USING (public.is_finance());

-- account_transactions: SELECT → founder + accountant only
DROP POLICY IF EXISTS "account_transactions_read_finance_gm" ON account_transactions;
DROP POLICY IF EXISTS "account_transactions_read_finance" ON account_transactions;
CREATE POLICY "account_transactions_read_finance" ON account_transactions
  FOR SELECT TO authenticated USING (public.is_finance());
