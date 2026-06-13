-- Let the core team hold crew CONTACTS (name/email/mobile), not only app users.
-- user_id becomes optional; if the email matches an app user we still link it so
-- they get project access. Run once. Safe to re-run.
ALTER TABLE project_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_email TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_phone TEXT;
