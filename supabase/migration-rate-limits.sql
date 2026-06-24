-- ─────────────────────────────────────────────
-- Generic fixed-window rate-limit table (Website ecosystem hardening).
-- Backs lib/rate-limit.ts `rateLimit()` for the public /api/public/* endpoints,
-- keyed by "pub:<route>:<ip>". Separate from wa_rate_limit (WhatsApp).
-- Service-role only — RLS enabled with NO policies (no client access at all).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role (admin) client may read/write (it bypasses RLS).
