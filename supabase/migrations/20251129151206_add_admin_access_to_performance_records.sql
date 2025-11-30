/*
  # パフォーマンス計測の管理者権限制御

  ## 概要
  パフォーマンス記録に対する管理者権限を追加します。
  管理者は組織内のすべてのアスリートのパフォーマンス記録を閲覧・管理できます。

  ## 修正内容
  - 管理者がすべてのパフォーマンス記録を閲覧できるポリシーを追加
  - 管理者がパフォーマンス記録を作成・更新・削除できるポリシーを追加
  - コーチ・スタッフが担当チームの記録を作成できるポリシーを追加

  ## セキュリティ
  - 管理者のみが全アクセス権を持つ
  - コーチは担当チームの閲覧と作成のみ可能
  - アスリートは自分の記録のみ管理可能
*/

-- 管理者用のRLSポリシー: performance_records（全記録を閲覧）
CREATE POLICY "Admins can view all performance records"
  ON performance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 管理者用のRLSポリシー: performance_records（全記録を作成）
CREATE POLICY "Admins can insert all performance records"
  ON performance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 管理者用のRLSポリシー: performance_records（全記録を更新）
CREATE POLICY "Admins can update all performance records"
  ON performance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 管理者用のRLSポリシー: performance_records（全記録を削除）
CREATE POLICY "Admins can delete all performance records"
  ON performance_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- コーチ・スタッフ用のRLSポリシー: performance_records（担当チームの記録を作成）
CREATE POLICY "Staff can insert team member performance records"
  ON performance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );

-- コーチ・スタッフ用のRLSポリシー: performance_records（担当チームの記録を更新）
CREATE POLICY "Staff can update team member performance records"
  ON performance_records FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );
