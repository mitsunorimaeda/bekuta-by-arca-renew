/*
  # チーム達成通知・祝福機能

  ## 概要
  チーム全体の達成を祝福する通知機能を実装します。
  チームメンバー全員が特定の目標を達成した際に、自動的にバッジを授与し、
  祝福メッセージを表示します。

  ## 新規テーブル

  ### 1. team_achievements（チーム達成記録）
  - `id` (uuid): ID
  - `team_id` (uuid): チームID
  - `achievement_type` (text): 達成タイプ
  - `title` (text): タイトル
  - `description` (text): 説明
  - `achieved_at` (timestamptz): 達成日時
  - `metadata` (jsonb): メタデータ
  - `celebrated` (boolean): 祝福表示済みか

  ### 2. team_achievement_notifications（チーム達成通知）
  - `id` (uuid): ID
  - `team_id` (uuid): チームID
  - `user_id` (uuid): ユーザーID
  - `achievement_id` (uuid): 達成ID
  - `is_read` (boolean): 既読フラグ
  - `created_at` (timestamptz): 作成日時

  ## 新規バッジ
  - チーム全員が7日連続記録達成
  - チーム平均ACWR良好維持
  - チーム全員がパーソナルベスト更新

  ## セキュリティ
  - チームメンバーは自分のチームの達成記録を閲覧可能
  - 管理者は全チームの達成記録を閲覧可能
*/

-- 1. team_achievements テーブル
CREATE TABLE IF NOT EXISTS team_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  achievement_type text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  achieved_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  celebrated boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE team_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team achievements"
  ON team_achievements FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all team achievements"
  ON team_achievements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert team achievements"
  ON team_achievements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update team achievements"
  ON team_achievements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. team_achievement_notifications テーブル
CREATE TABLE IF NOT EXISTS team_achievement_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  achievement_id uuid REFERENCES team_achievements(id) ON DELETE CASCADE NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE team_achievement_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team notifications"
  ON team_achievement_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON team_achievement_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON team_achievement_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_team_achievements_team_id ON team_achievements(team_id);
CREATE INDEX IF NOT EXISTS idx_team_achievements_achieved_at ON team_achievements(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_achievement_notifications_user_id ON team_achievement_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_team_achievement_notifications_unread ON team_achievement_notifications(user_id, is_read);

-- チーム達成バッジの追加
INSERT INTO badges (name, description, icon, category, rarity, criteria, points_reward, sort_order) VALUES
  ('チーム団結', 'チーム全員が7日連続で記録を入力', 'Users', 'team', 'rare', '{"type": "team_streak", "days": 7}', 200, 101),
  ('チーム一丸', 'チーム全員が30日連続で記録を入力', 'Shield', 'team', 'epic', '{"type": "team_streak", "days": 30}', 500, 102),
  ('チーム最高記録', 'チーム全員がパーソナルベストを更新', 'Award', 'team', 'epic', '{"type": "team_personal_best"}', 400, 103),
  ('安全第一チーム', 'チーム平均ACWRが30日間安全圏', 'ShieldCheck', 'team', 'epic', '{"type": "team_acwr_safe", "days": 30}', 450, 104),
  ('目標達成チーム', 'チーム全員が今月の目標を達成', 'Target', 'team', 'legendary', '{"type": "team_goals_complete"}', 600, 105)
ON CONFLICT (name) DO NOTHING;

-- 関数: チーム達成の記録と通知
CREATE OR REPLACE FUNCTION record_team_achievement(
  p_team_id uuid,
  p_achievement_type text,
  p_title text,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_achievement_id uuid;
  v_user_record RECORD;
BEGIN
  -- チーム達成を記録
  INSERT INTO team_achievements (team_id, achievement_type, title, description, metadata)
  VALUES (p_team_id, p_achievement_type, p_title, p_description, p_metadata)
  RETURNING id INTO v_achievement_id;

  -- チームメンバー全員に通知を作成
  FOR v_user_record IN 
    SELECT id FROM users 
    WHERE team_id = p_team_id 
    AND role = 'athlete'
  LOOP
    INSERT INTO team_achievement_notifications (team_id, user_id, achievement_id)
    VALUES (p_team_id, v_user_record.id, v_achievement_id);
  END LOOP;

  RETURN v_achievement_id;
END;
$$;

-- 関数: チーム達成通知を既読にする
CREATE OR REPLACE FUNCTION mark_team_notification_read(
  p_notification_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE team_achievement_notifications
  SET is_read = true
  WHERE id = p_notification_id
  AND user_id = auth.uid();
END;
$$;

-- 関数: チーム達成を祝福済みにする
CREATE OR REPLACE FUNCTION mark_team_achievement_celebrated(
  p_achievement_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE team_achievements
  SET celebrated = true
  WHERE id = p_achievement_id;
END;
$$;
