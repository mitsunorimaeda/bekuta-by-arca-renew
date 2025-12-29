/*
  # Fix organization_members RLS recursion (SAFE / IDEMPOTENT)
  - users テーブル参照を一切しない
  - policy衝突を防ぐため、既存policyを全部DROPしてから作り直す
*/

SET search_path = public;

-- 既存 policies を全部削除
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='organization_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members;', p.policyname);
  END LOOP;
END $$;

-- 読み取り：認証ユーザーは読める（ここは割り切り。必要なら後で絞る）
CREATE POLICY "OrgMembers select: authenticated"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (true);

-- 以降、書き込みは「organization_admin」だけ許可（users参照なし）
-- INSERT
CREATE POLICY "OrgMembers insert: org_admin"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_members.organization_id
        AND om.role = 'organization_admin'
    )
  );

-- UPDATE
CREATE POLICY "OrgMembers update: org_admin"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_members.organization_id
        AND om.role = 'organization_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_members.organization_id
        AND om.role = 'organization_admin'
    )
  );

-- DELETE
CREATE POLICY "OrgMembers delete: org_admin"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_members.organization_id
        AND om.role = 'organization_admin'
    )
  );

DO $$
BEGIN
  RAISE NOTICE 'organization_members RLS policies reset successfully (SAFE)';
END $$;