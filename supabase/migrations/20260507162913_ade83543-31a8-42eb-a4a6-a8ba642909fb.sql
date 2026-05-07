DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='project_collaborators_access_level_check' AND table_schema='public') THEN
    ALTER TABLE public.project_collaborators DROP CONSTRAINT project_collaborators_access_level_check;
  END IF;
  ALTER TABLE public.project_collaborators
    ADD CONSTRAINT project_collaborators_access_level_check
    CHECK (access_level IN ('read','restricted_write','write'));
END $$;