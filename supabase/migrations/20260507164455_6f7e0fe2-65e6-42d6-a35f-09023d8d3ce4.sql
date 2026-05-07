CREATE OR REPLACE FUNCTION public.guard_project_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN OLD;
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rmq')) THEN
    RAISE EXCEPTION 'Seul un administrateur peut supprimer un projet. Utilisez l''archivage.';
  END IF;
  IF OLD.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Suppression interdite : projet créé il y a plus de 7 jours. Utilisez l''archivage.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_project_delete_trg ON public.projects;
CREATE TRIGGER guard_project_delete_trg
BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_delete();