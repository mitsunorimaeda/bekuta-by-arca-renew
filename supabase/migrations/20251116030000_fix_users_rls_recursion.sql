/*
  # Fix RLS recursion issue in users table (SAFE / IDEMPOTENT)

  - users テーブルの RLS 再帰を完全に除去
  - policy 衝突を防ぐため、必ず DROP → CREATE
*/

SET search_path = public;

-- ===============================
-- STEP 1: users の既存 RLS を全削除
-- ===============================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users;', p.policyname);
  END LOOP;
END $$;

-- ===============================
-- STEP 2: 必要最小限の RLS を再定義
-- ===============================

-- ① ユーザー本人は自分の情報を管理できる
CREATE POLICY "Users can manage own profile"
  ON public.users
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ② 認証ユーザーは基本情報を閲覧可能（チーム表示など用）
CREATE POLICY "Authenticated users can view basic user info"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- ③ 組織管理者は users を管理できる（再帰なし）
CREATE POLICY "Organization admins can manage users"
  ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role = 'organization_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role = 'organization_admin'
    )
  );

DO $$
BEGIN
  RAISE NOTICE 'users RLS policies reset successfully (SAFE)';
END $$;