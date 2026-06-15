-- Payment confirmation details entered by the accountant when marking a bill paid.
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS paid_reference TEXT;   -- UTR / cheque no / UPI ref
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS paid_mode TEXT;        -- bank / upi / cheque / cash
