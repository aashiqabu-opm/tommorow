-- Per-sender rate limiting for the WhatsApp inbound webhook (see lib/rate-limit.ts).
-- Fixed-window counter keyed by phone. Written via service-role admin only.
CREATE TABLE IF NOT EXISTS wa_rate_limit (
  phone TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE wa_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies: only the admin client (service role, bypasses RLS) touches this.
