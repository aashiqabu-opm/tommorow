-- AI document intelligence: store Claude's structured analysis on each
-- document so it's "remembered" and can be surfaced + alerted on.
-- Run once in the Supabase SQL editor.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;
