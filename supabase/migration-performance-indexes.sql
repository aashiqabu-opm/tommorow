-- OPM Office — Performance Indexes
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- Each index matches a real query pattern in the app.

-- Accounts page: latest transactions sliced per account
CREATE INDEX IF NOT EXISTS idx_account_txns_account_date
  ON account_transactions(account_id, txn_date DESC);

-- Reports + dashboard: payment registers filtered/ordered by date
CREATE INDEX IF NOT EXISTS idx_payment_requests_created
  ON payment_requests(created_at);

-- Vendors page: total-paid aggregation per vendor (only paid rows matter)
CREATE INDEX IF NOT EXISTS idx_payment_requests_vendor_paid
  ON payment_requests(payee_vendor_id)
  WHERE payment_status = 'paid' AND payee_vendor_id IS NOT NULL;

-- Reports: liability payments by date range
CREATE INDEX IF NOT EXISTS idx_liability_payments_date
  ON liability_payments(payment_date);

-- Payments page: comments looked up by entity
CREATE INDEX IF NOT EXISTS idx_comments_entity
  ON comments(entity_type, entity_id);

-- Audit page: newest-first log listing
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);

-- Dashboard: monthly income chart filtered by date
CREATE INDEX IF NOT EXISTS idx_project_income_date
  ON project_income(income_date);

-- Payroll page: pending salary liabilities for the current month
CREATE INDEX IF NOT EXISTS idx_liabilities_type_status
  ON liabilities(type, status);

-- Notifications: reminder-sweep dedupe (recent notifications per user)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
