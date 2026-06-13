-- OPM Office — Revenue / Collections module
-- Enriches project_income with film-revenue fields. Run in Supabase SQL Editor.
-- All additive & nullable — existing rows keep working (status defaults to 'received').

ALTER TABLE project_income ADD COLUMN IF NOT EXISTS party TEXT;             -- distributor / platform / buyer
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS territory TEXT;         -- e.g. Kerala, Worldwide, GCC
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15, 2);    -- deal/gross value
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(15, 2); -- distributor commission / deduction
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS expected_date DATE;     -- when a receivable is due
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received'
  CHECK (status IN ('received', 'receivable'));

-- Fast filters for the Revenue page
CREATE INDEX IF NOT EXISTS idx_project_income_status ON project_income(status);
CREATE INDEX IF NOT EXISTS idx_project_income_source ON project_income(source);
