-- OPM Office — Priority Projects + Project Details
-- Run in Supabase SQL Editor. Safe to re-run.

-- 1. Priority flag
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. All projects active
UPDATE projects SET status = 'active', updated_at = NOW();

-- 3. Kaali (new project — shoot starts November 2026)
INSERT INTO projects (name, slug, status, is_priority, start_date, description, created_by)
SELECT 'Kaali', 'kaali', 'active', TRUE, '2026-11-01',
       'Priority project. Shoot begins November 2026.',
       (SELECT id FROM profiles WHERE role = 'founder' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'kaali');

-- 4. Priority projects + details
UPDATE projects SET
  is_priority = TRUE,
  description = 'Priority project. Targeting Onam 2026 theatrical release.',
  end_date = '2026-08-26',          -- Thiruvonam 2026; adjust if needed
  updated_at = NOW()
WHERE name ILIKE 'aja sundari';

UPDATE projects SET
  is_priority = TRUE,
  description = 'Priority project. Internal operating system for OPM Cinemas — finance, payments, documents, payroll.',
  updated_at = NOW()
WHERE name ILIKE 'opm office';

UPDATE projects SET
  is_priority = TRUE,
  description = 'Priority project. Shoot begins November 2026.',
  start_date = '2026-11-01',
  updated_at = NOW()
WHERE name ILIKE 'kaali';

-- 5. Default description for any project still missing one (never overwrites)
UPDATE projects SET description = 'OPM Cinemas feature film project.', updated_at = NOW()
WHERE description IS NULL OR description = '';
