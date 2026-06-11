-- OPM Office — Outbound Alerts (email / WhatsApp)
-- Run in Supabase SQL Editor after migration-v3-upgrade.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_alerts BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Alert categories a user has muted ('payments', 'liabilities', 'documents', 'cash', 'payroll', 'general')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS muted_categories TEXT[] NOT NULL DEFAULT '{}';
