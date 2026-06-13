-- Auto-add default core-team members (Abid as Executive Producer, Madan as
-- General Manager) to every project — on creation, and backfill existing ones.
-- Run once. Safe to re-run. Adjust the emails if theirs differ.

CREATE OR REPLACE FUNCTION public.add_default_project_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT id, email FROM profiles WHERE lower(email) IN ('abid@opmcinemas.com','madan@opmcinemas.com') LOOP
    INSERT INTO project_members (project_id, user_id, project_role)
    VALUES (NEW.id, p.id,
      CASE WHEN lower(p.email) = 'abid@opmcinemas.com' THEN 'executive_producer' ELSE 'general_manager' END)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_project_members ON projects;
CREATE TRIGGER trg_default_project_members AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.add_default_project_members();

-- Backfill every existing project
INSERT INTO project_members (project_id, user_id, project_role)
SELECT pr.id, pf.id,
  CASE WHEN lower(pf.email) = 'abid@opmcinemas.com' THEN 'executive_producer' ELSE 'general_manager' END
FROM projects pr
CROSS JOIN profiles pf
WHERE lower(pf.email) IN ('abid@opmcinemas.com','madan@opmcinemas.com')
ON CONFLICT (project_id, user_id) DO NOTHING;
