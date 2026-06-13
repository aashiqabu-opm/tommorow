-- Open document access to senior management: General Manager & Executive
-- Producer now read all documents (same as founder & accountant). Legal
-- viewers stay limited to project_team / all_staff, and any future role gets
-- no document access until explicitly granted. Run once in the SQL editor.

DROP POLICY IF EXISTS "documents_read" ON documents;

CREATE POLICY "documents_read" ON documents
  FOR SELECT TO authenticated USING (
    -- Founder, accountant, GM and EP see all documents
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
    OR
    -- Legal viewer (and only this restricted role) sees shared docs only
    (public.user_role() = 'legal_viewer' AND access_level IN ('project_team', 'all_staff'))
  );
