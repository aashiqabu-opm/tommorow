-- OPM Office — Initial Seed Data
-- Run in Supabase SQL Editor after migration-v3-upgrade.sql
-- Safe to re-run: uses ON CONFLICT DO NOTHING or INSERT IF NOT EXISTS guards

-- ─── STAFF SALARIES (Payroll) ─────────────────────────────────────────────
-- Clears existing rows only for the names listed, then inserts fresh
DELETE FROM staff_salaries WHERE person_name IN (
  'Abid Abu', 'Madan', 'Shiny', 'Subin', 'Sudarsan', 'Muthulakshmi'
);

INSERT INTO staff_salaries (person_name, role_title, monthly_salary, is_active) VALUES
  ('Abid Abu',       'Production Manager',     25000.00, TRUE),
  ('Madan',          'Cinematographer',         25000.00, TRUE),
  ('Shiny',          'Accountant',              25000.00, TRUE),
  ('Subin',          'Production Assistant',    20000.00, TRUE),
  ('Sudarsan',       'Catering / Cook',         32500.00, TRUE),
  ('Muthulakshmi',   'Housekeeping',             7000.00, TRUE);

-- ─── BANK / CASH ACCOUNTS ─────────────────────────────────────────────────
-- Insert only if no accounts exist yet
INSERT INTO bank_accounts (name, account_type, opening_balance, current_balance, is_active)
SELECT name, account_type, opening_balance, current_balance, TRUE
FROM (VALUES
  ('OPM Main Account',   'bank',         0.00, 0.00),
  ('OPM Petty Cash',     'cash_drawer',  0.00, 0.00),
  ('OPM UPI (PhonePe)',  'upi',          0.00, 0.00)
) AS t(name, account_type, opening_balance, current_balance)
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts LIMIT 1);

-- ─── RECURRING LIABILITIES ────────────────────────────────────────────────
-- Office rent and electricity are liabilities, not payroll
-- Insert for current month (June 2026) if not already present

INSERT INTO liabilities (
  party_name, amount_owed, amount_paid, balance_remaining,
  original_date, due_date, type, priority, status, notes
)
SELECT
  party_name, amount_owed, 0.00, amount_owed,
  CURRENT_DATE, (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
  'rent', 'urgent', 'unpaid', notes
FROM (VALUES
  ('DLF E-102 (Office Rent)',     57400.00, 'Monthly office rent — E 102, DLF, June 2026'),
  ('KSEB E-102 (Electricity)',    12728.00, 'Electricity bill — E 102, June 2026')
) AS t(party_name, amount_owed, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM liabilities
  WHERE party_name = t.party_name
    AND DATE_TRUNC('month', original_date) = DATE_TRUNC('month', CURRENT_DATE)
);

-- ─── SUMMARY ──────────────────────────────────────────────────────────────
SELECT 'staff_salaries' AS table_name, COUNT(*) AS rows FROM staff_salaries
UNION ALL
SELECT 'bank_accounts',  COUNT(*) FROM bank_accounts
UNION ALL
SELECT 'liabilities (rent/electricity this month)', COUNT(*) FROM liabilities
WHERE party_name IN ('DLF E-102 (Office Rent)', 'KSEB E-102 (Electricity)')
  AND DATE_TRUNC('month', original_date) = DATE_TRUNC('month', CURRENT_DATE);
