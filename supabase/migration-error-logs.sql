-- Error monitoring log (see lib/monitoring.ts). Founder-only visibility.
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_read" ON error_logs;
CREATE POLICY "error_logs_read" ON error_logs FOR SELECT TO authenticated USING (public.is_founder());
-- Writes happen via the service-role admin client (bypasses RLS); no insert policy needed.
