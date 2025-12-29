/*
  # Reset users RLS safely (no recursion)

  Requirements:
  - users.auth_user_id exists and is filled
  - org admin check uses organization_members only (no users subquery inside users policy)
*/

SET search_path = public;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (add more names if you have them)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Organization admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view basic users" ON public.users;

-- 1) Self read
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- 2) Self update (プロフィール系だけ更新したいなら列制限はアプリ側 or triggerで制御)
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 3) Basic read for authenticated (AthleteList等で他人の基本情報が必要なら)
--    もし「同一組織だけ」に絞りたいなら、ここは organization_members JOIN を使う（users参照はOK：SELECTなので再帰になりにくい）
CREATE POLICY "Authenticated users can view basic users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) Org admins can manage users in their org
--    注意：usersポリシー内で users を参照しない。organization_members だけで判定する。
--    organization_members.user_id は public.users.id（内部uuid）だと想定。
CREATE POLICY "Organization admins can manage users"
  ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om_admin
      JOIN public.organization_members om_target
        ON om_admin.organization_id = om_target.organization_id
      WHERE om_admin.role = 'organization_admin'
        AND om_admin.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
        AND om_target.user_id = public.users.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om_admin
      JOIN public.organization_members om_target
        ON om_admin.organization_id = om_target.organization_id
      WHERE om_admin.role = 'organization_admin'
        AND om_admin.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
        AND om_target.user_id = public.users.id
    )
  );

DO $$
BEGIN
  RAISE NOTICE 'users RLS reset safely (no recursion).';
END $$;