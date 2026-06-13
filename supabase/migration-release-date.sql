-- Release date for release-window scanning. Run once. Safe to re-run.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS release_date DATE;
