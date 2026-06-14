-- ═══════════════════════════════════════════════════════════════════════
-- PERSONAL — transaction ingestion + reconciliation columns
-- origin: how the row arrived · dup_of: canonical row this duplicates ·
-- reconciled: pass has run. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual','alert','receipt','statement'));
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS dup_of UUID REFERENCES personal_transactions(id) ON DELETE SET NULL;
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS reconciled BOOLEAN NOT NULL DEFAULT FALSE;
-- Composite guard so statement lines (no message-id) aren't re-inserted on re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptxn_fingerprint
  ON personal_transactions(owner_id, source, txn_date, amount, lower(coalesce(merchant,'')))
  WHERE email_ref IS NULL;
