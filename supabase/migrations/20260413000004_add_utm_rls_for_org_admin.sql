-- user_team_memberships に org_admin 向け RLS ポリシーを追加
--
-- 既存ポリシー: utm_select_own → user_id = auth.uid() OR is_global_admin()
--   → org_admin は自分のメンバーシップ行しか見えず、チームメンバー一覧が取得できない
--
-- 追加: org_admin は自分の組織に属するチームの全メンバーシップを操作可能にする

-- SELECT: org admin が組織内の全メンバーシップを参照できる
CREATE POLICY "utm_select_org_admin"
  ON public.user_team_memberships
  FOR SELECT
  USING (
    is_org_admin((SELECT organization_id FROM public.teams WHERE id = team_id))
  );

-- INSERT: org admin が組織内チームにメンバーを追加できる
CREATE POLICY "utm_insert_org_admin"
  ON public.user_team_memberships
  FOR INSERT
  WITH CHECK (
    is_org_admin((SELECT organization_id FROM public.teams WHERE id = team_id))
  );

-- UPDATE: org admin が組織内のメンバーシップ（team_id変更＝移動）を更新できる
-- USING = 更新前のチームが自組織、WITH CHECK = 更新後のチームも自組織
CREATE POLICY "utm_update_org_admin"
  ON public.user_team_memberships
  FOR UPDATE
  USING (
    is_org_admin((SELECT organization_id FROM public.teams WHERE id = team_id))
  )
  WITH CHECK (
    is_org_admin((SELECT organization_id FROM public.teams WHERE id = team_id))
  );
