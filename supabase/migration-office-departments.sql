-- ═══════════════════════════════════════════════════════════════════════
-- OPM Office — make it a professional production-office task system:
-- departments, role-based assignment, and recurring standard workload.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE office_tasks ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'administration'
  CHECK (department IN ('administration','accounts','production','legal','hr','procurement','it','facilities','marketing','general'));
ALTER TABLE office_tasks ADD COLUMN IF NOT EXISTS assigned_role TEXT
  CHECK (assigned_role IN ('founder','accountant','general_manager','executive_producer','legal_viewer','staff'));
ALTER TABLE office_tasks ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'
  CHECK (recurrence IN ('none','weekly','monthly','quarterly','annual'));

-- migrate existing category values onto department where sensible
UPDATE office_tasks SET department = CASE
  WHEN category = 'finance' THEN 'accounts'
  WHEN category = 'compliance' THEN 'legal'
  WHEN category IN ('hr','procurement','it','facilities','legal') THEN category
  ELSE 'administration' END
WHERE department = 'administration';

CREATE INDEX IF NOT EXISTS idx_office_tasks_dept_role ON office_tasks(department, assigned_role);
