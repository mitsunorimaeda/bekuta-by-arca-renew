/*
  # Unify user identity for RLS (auth.uid() <-> public.users)

  Goal:
  - Add public.users.auth_user_id (uuid) that equals auth.users.id
  - Backfill using:
      1) users.user_id (text) if it looks like uuid
      2) users.email join auth.users.email
  - Enforce uniqueness + fast lookup
  - (Optional) keep old users.user_id as legacy, but RLS will use auth_user_id going forward
*/

SET search_path = public;

-- 0) Add column if missing
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- 1) Backfill from users.user_id when it's a uuid string
--    Safe cast via regex guard
UPDATE public.users u
SET auth_user_id = u.user_id::uuid
WHERE u.auth_user_id IS NULL
  AND u.user_id IS NOT NULL
  AND u.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 2) Backfill from email (auth.users.email)
--    If your auth.users uses lower/upper variance, normalize with lower()
UPDATE public.users u
SET auth_user_id = a.id
FROM auth.users a
WHERE u.auth_user_id IS NULL
  AND u.email IS NOT NULL
  AND a.email IS NOT NULL
  AND lower(a.email) = lower(u.email);

-- 3) (Optional) If multiple auth users share an email (rare), you may still have NULLs.
--    We just report counts as NOTICE.
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.users
  WHERE auth_user_id IS NULL;

  RAISE NOTICE 'users.auth_user_id missing rows: %', missing_count;
END $$;

-- 4) Enforce uniqueness (only for non-null values)
--    Unique index instead of constraint makes partial possible
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 5) Helpful index for RLS lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id);

-- 6) (Optional but recommended) Make auth_user_id NOT NULL after you confirm missing_count=0
--    Uncomment after confirmation
-- ALTER TABLE public.users
--   ALTER COLUMN auth_user_id SET NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'Unify users identity done. Use public.users.auth_user_id for RLS going forward.';
END $$;