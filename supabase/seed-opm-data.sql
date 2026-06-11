-- OPM Office — Payroll Seed Data
-- Run in Supabase SQL Editor after migration-v3-upgrade.sql

DELETE FROM staff_salaries WHERE person_name IN (
  'Abid Abu', 'Madan', 'Shiny', 'Subin', 'Sudarsan', 'Muthulakshmi'
);

INSERT INTO staff_salaries (person_name, monthly_salary, is_active) VALUES
  ('Abid Abu',     25000.00, TRUE),
  ('Madan',        25000.00, TRUE),
  ('Shiny',        25000.00, TRUE),
  ('Subin',        20000.00, TRUE),
  ('Sudarsan',     32500.00, TRUE),
  ('Muthulakshmi',  7000.00, TRUE);
