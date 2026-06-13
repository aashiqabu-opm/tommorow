-- Let accountants (not just the founder) delete cash entries.
-- Deletions are still written to audit_logs, so history is preserved.
-- Run once in the Supabase SQL editor.

DROP POLICY IF EXISTS "cash_delete_founder" ON cash_entries;

CREATE POLICY "cash_delete_finance" ON cash_entries
  FOR DELETE TO authenticated USING (public.is_finance());
