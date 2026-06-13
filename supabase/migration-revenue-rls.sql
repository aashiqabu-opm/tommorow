-- project_income had NO row-level security: any authenticated user (even
-- non-finance roles) could read/write/delete revenue rows straight through the
-- API; only the UI hid the page. Lock it down to finance roles, matching the
-- cash_entries / liabilities pattern. Run once in the Supabase SQL editor.

ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_read_finance" ON project_income;
DROP POLICY IF EXISTS "income_insert_finance" ON project_income;
DROP POLICY IF EXISTS "income_update_finance" ON project_income;
DROP POLICY IF EXISTS "income_delete_finance" ON project_income;

CREATE POLICY "income_read_finance" ON project_income
  FOR SELECT TO authenticated USING (public.is_finance());

CREATE POLICY "income_insert_finance" ON project_income
  FOR INSERT TO authenticated WITH CHECK (public.is_finance());

CREATE POLICY "income_update_finance" ON project_income
  FOR UPDATE TO authenticated USING (public.is_finance());

CREATE POLICY "income_delete_finance" ON project_income
  FOR DELETE TO authenticated USING (public.is_finance());
