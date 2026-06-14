-- Personal bank account essentials (IFSC, branch, account no) for the
-- Accounts section. Idempotent.
ALTER TABLE personal_accounts ADD COLUMN IF NOT EXISTS account_no TEXT;
ALTER TABLE personal_accounts ADD COLUMN IF NOT EXISTS ifsc TEXT;
ALTER TABLE personal_accounts ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE personal_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT;
