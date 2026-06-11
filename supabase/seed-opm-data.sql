-- OPM Office — Payroll Seed Data
-- Run in Supabase SQL Editor after migration-v3-upgrade.sql

DELETE FROM staff_salaries WHERE person_name IN (
  'Abid Abu', 'Madan', 'Shiny', 'Subin', 'Sudarsan', 'Muthulakshmi'
);

INSERT INTO staff_salaries (person_name, role_title, monthly_salary, is_active) VALUES
  ('Abid Abu',      'Production Manager',   25000.00, TRUE),
  ('Madan',         'Cinematographer',      25000.00, TRUE),
  ('Shiny',         'Accountant',           25000.00, TRUE),
  ('Subin',         'Production Assistant', 20000.00, TRUE),
  ('Sudarsan',      'Cook',                 32500.00, TRUE),
  ('Muthulakshmi',  'Housekeeping',          7000.00, TRUE);
