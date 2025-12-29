SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
$$;

-- 権限：authenticatedが使えるように
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'current_app_user_id() created.';
END $$;