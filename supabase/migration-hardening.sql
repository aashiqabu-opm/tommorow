-- ═════════════════════════════════════════════════════════════
-- Hardening: month-end period lock + AI usage metering
--   • app_settings: key/value (books_locked_through, ai_monthly_cap)
--   • DB-level period lock — closed months can't be edited/back-dated
--   • ai_usage: one row per AI call, for a monthly cap + meter
-- Run once, AFTER the other migrations (needs vouchers/cash_entries).
-- Safe to re-run.
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read" ON app_settings;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
CREATE POLICY "app_settings_write" ON app_settings FOR ALL TO authenticated USING (public.is_founder()) WITH CHECK (public.is_founder());

-- The date the books are closed through (NULL = open).
CREATE OR REPLACE FUNCTION public.locked_through()
RETURNS DATE LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NULLIF((SELECT value FROM app_settings WHERE key = 'books_locked_through'), '')::date;
$$;

-- Trigger: block writes to a row whose date falls on/before the lock date.
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lt DATE; d DATE; col TEXT := TG_ARGV[0];
BEGIN
  lt := public.locked_through();
  IF lt IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN d := (row_to_json(OLD) ->> col)::date;
  ELSE d := (row_to_json(NEW) ->> col)::date; END IF;
  IF d IS NOT NULL AND d <= lt THEN
    RAISE EXCEPTION 'Books are locked through %. This entry falls in a closed period — unlock it in Settings to change it.', to_char(lt, 'DD-Mon-YYYY');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to the accounting tables that have a date (skip any not yet created).
DO $$ BEGIN
  IF to_regclass('public.project_income') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_project_income ON project_income;
    CREATE TRIGGER lock_project_income BEFORE INSERT OR UPDATE OR DELETE ON project_income
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('income_date');
  END IF;
  IF to_regclass('public.cash_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_cash_entries ON cash_entries;
    CREATE TRIGGER lock_cash_entries BEFORE INSERT OR UPDATE OR DELETE ON cash_entries
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('entry_date');
  END IF;
  IF to_regclass('public.vouchers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_vouchers ON vouchers;
    CREATE TRIGGER lock_vouchers BEFORE INSERT OR UPDATE OR DELETE ON vouchers
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('voucher_date');
  END IF;
END $$;

-- AI usage log — one row per AI call (for monthly cap + meter)
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_read" ON ai_usage;
CREATE POLICY "ai_usage_read" ON ai_usage FOR SELECT TO authenticated USING (public.is_finance());
-- Writes happen via the service-role client (bypasses RLS).
