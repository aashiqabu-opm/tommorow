-- App-wide status flags (e.g. AI paused because Anthropic credits are out).
-- Written by the server (service role); read by all signed-in users for a banner.
-- Run once. Safe to re-run.
CREATE TABLE IF NOT EXISTS system_status (
  key TEXT PRIMARY KEY,
  message TEXT,
  detail TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_status_read" ON system_status;
CREATE POLICY "system_status_read" ON system_status FOR SELECT TO authenticated USING (TRUE);
-- Writes happen via the service-role client (bypasses RLS); no write policy needed.
