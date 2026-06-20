ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_operations BOOLEAN NOT NULL DEFAULT FALSE; UPDATE projects SET is_operations=TRUE WHERE name='OPM Office';
