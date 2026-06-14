-- Per-email processed marker so the monthly sync never re-parses (re-AI-costs)
-- an email it already handled — keeps runs fast and lets reconcile finish.
CREATE TABLE IF NOT EXISTS personal_synced_emails (
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, message_id));
-- Backfill from already-imported alert/receipt rows (statements have null email_ref).
INSERT INTO personal_synced_emails (owner_id, message_id)
SELECT DISTINCT owner_id, email_ref FROM personal_transactions WHERE email_ref IS NOT NULL
ON CONFLICT DO NOTHING;
