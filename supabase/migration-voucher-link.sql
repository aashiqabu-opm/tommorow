-- Link auto-generated vouchers back to the payment/income they came from, so
-- generation is idempotent (one voucher per source). Run after migration-vouchers.sql.
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source_type TEXT;   -- 'payment' | 'income'
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_source ON vouchers(source_type, source_id) WHERE source_type IS NOT NULL;
