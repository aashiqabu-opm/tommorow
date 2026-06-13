-- ═════════════════════════════════════════════════════════════
-- AI daily project-stage tracking
--   • The daily cron auto-advances a project's stage and records
--     why + when. Forward-only; never touches on_hold / cancelled.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ═════════════════════════════════════════════════════════════

ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_status_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_status_at TIMESTAMPTZ;

-- Set Aja Sundari to post-production now (the cron keeps it current after).
-- Matches by name; harmless if the project doesn't exist.
UPDATE projects
SET status = 'post_production',
    ai_status_reason = 'Shoot wrapped — moved to post-production.',
    ai_status_at = NOW(),
    updated_at = NOW()
WHERE name ILIKE '%aja sundari%' AND status NOT IN ('released', 'cancelled');
