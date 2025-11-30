/*
  # ゲーミフィケーションとエンゲージメントシステムの構築

  ## 概要
  アスリートの継続利用とモチベーション維持のための包括的なゲーミフィケーションシステムを構築します。
  このマイグレーションには以下が含まれます:

  ## 新しいテーブル

  ### 1. user_streaks - ユーザーのストリーク（連続記録日数）
  - `user_id` (uuid, FK to users)
  - `streak_type` (text) - 'training', 'weight', 'sleep', 'motivation', 'all'
  - `current_streak` (integer) - 現在の連続記録日数
  - `longest_streak` (integer) - 過去最長の連続記録日数
  - `last_recorded_date` (date) - 最後に記録した日付
  - `streak_freeze_count` (integer) - ストリーク保護の残り回数
  - `total_records` (integer) - 総記録数

  ### 2. user_points - ユーザーのポイントとレベル
  - `user_id` (uuid, FK to users)
  - `total_points` (integer) - 累計ポイント
  - `current_level` (integer) - 現在のレベル
  - `points_to_next_level` (integer) - 次のレベルまでのポイント
  - `rank_title` (text) - ランクタイトル

  ### 3. point_transactions - ポイント獲得履歴
  - `user_id` (uuid, FK to users)
  - `points` (integer) - 獲得ポイント数
  - `reason` (text) - 獲得理由
  - `category` (text) - カテゴリー
  - `metadata` (jsonb) - 追加情報

  ### 4. badges - バッジマスターデータ
  - `name` (text) - バッジ名
  - `description` (text) - バッジの説明
  - `icon` (text) - アイコン名
  - `category` (text) - カテゴリー
  - `rarity` (text) - レアリティ (common, rare, epic, legendary)
  - `criteria` (jsonb) - 獲得条件
  - `points_reward` (integer) - 獲得時のポイント

  ### 5. user_badges - ユーザーが獲得したバッジ
  - `user_id` (uuid, FK to users)
  - `badge_id` (uuid, FK to badges)
  - `earned_at` (timestamp)
  - `is_new` (boolean) - 未確認の新バッジか

  ### 6. user_goals - ユーザーの目標設定
  - `user_id` (uuid, FK to users)
  - `goal_type` (text) - 'performance', 'weight', 'streak', 'habit', 'custom'
  - `title` (text) - 目標のタイトル
  - `description` (text) - 詳細説明
  - `target_value` (numeric) - 目標値
  - `current_value` (numeric) - 現在値
  - `unit` (text) - 単位
  - `deadline` (date) - 期限
  - `status` (text) - 'active', 'completed', 'failed', 'abandoned'
  - `metadata` (jsonb) - 追加情報

  ### 7. coach_comments - コーチからのコメント
  - `athlete_id` (uuid, FK to users)
  - `coach_id` (uuid, FK to users)
  - `related_record_type` (text) - 'training', 'performance', 'weight', 'general'
  - `related_record_id` (uuid) - 関連するレコードのID
  - `comment` (text) - コメント内容
  - `is_read` (boolean) - アスリートが既読にしたか
  - `sentiment` (text) - 'positive', 'neutral', 'constructive'

  ### 8. team_rankings - チーム内ランキング（物理テーブルではなくビューとして実装）

  ### 9. achievement_milestones - マイルストーン達成履歴
  - `user_id` (uuid, FK to users)
  - `milestone_type` (text) - マイルストーンの種類
  - `title` (text) - タイトル
  - `description` (text) - 説明
  - `achieved_value` (numeric) - 達成値
  - `celebrated` (boolean) - 祝福表示済みか

  ## セキュリティ
  - すべてのテーブルでRLSを有効化
  - ユーザーは自分のデータのみ読み取り・書き込み可能
  - コーチは担当アスリートのデータを読み取り可能
  - バッジマスターデータは全員が読み取り可能
*/

-- 1. user_streaks テーブル
CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  streak_type text NOT NULL CHECK (streak_type IN ('training', 'weight', 'sleep', 'motivation', 'all')),
  current_streak integer DEFAULT 0 NOT NULL,
  longest_streak integer DEFAULT 0 NOT NULL,
  last_recorded_date date,
  streak_freeze_count integer DEFAULT 1 NOT NULL,
  total_records integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, streak_type)
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks"
  ON user_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON user_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON user_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. user_points テーブル
CREATE TABLE IF NOT EXISTS user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_points integer DEFAULT 0 NOT NULL,
  current_level integer DEFAULT 1 NOT NULL,
  points_to_next_level integer DEFAULT 100 NOT NULL,
  rank_title text DEFAULT 'ビギナー' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points"
  ON user_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points"
  ON user_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own points"
  ON user_points FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Team members can view each other's points for rankings
CREATE POLICY "Team members can view team points"
  ON user_points FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_points.user_id
      AND u.team_id IN (
        SELECT team_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- 3. point_transactions テーブル
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  category text NOT NULL CHECK (category IN ('record', 'streak', 'achievement', 'goal', 'social', 'bonus')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON point_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON point_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. badges マスターテーブル
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL CHECK (category IN ('streak', 'performance', 'consistency', 'milestone', 'special', 'team')),
  rarity text NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) DEFAULT 'common',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  points_reward integer DEFAULT 0 NOT NULL,
  sort_order integer DEFAULT 0,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- 5. user_badges テーブル
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE NOT NULL,
  earned_at timestamptz DEFAULT now() NOT NULL,
  is_new boolean DEFAULT true NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own badges"
  ON user_badges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Team members can view each other's badges
CREATE POLICY "Team members can view team badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_badges.user_id
      AND u.team_id IN (
        SELECT team_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- 6. user_goals テーブル
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('performance', 'weight', 'streak', 'habit', 'custom')),
  title text NOT NULL,
  description text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  deadline date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals"
  ON user_goals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coaches can view athlete goals
CREATE POLICY "Coaches can view athlete goals"
  ON user_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN staff_team_links stl ON stl.team_id = u.team_id
      WHERE u.id = user_goals.user_id
      AND stl.staff_user_id = auth.uid()
    )
  );

-- 7. coach_comments テーブル
CREATE TABLE IF NOT EXISTS coach_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  coach_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  related_record_type text CHECK (related_record_type IN ('training', 'performance', 'weight', 'sleep', 'motivation', 'general')),
  related_record_id uuid,
  comment text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  sentiment text DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'constructive')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE coach_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own comments"
  ON coach_comments FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can update read status"
  ON coach_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Coaches can manage comments for their athletes"
  ON coach_comments FOR ALL
  TO authenticated
  USING (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN staff_team_links stl ON stl.team_id = u.team_id
      WHERE u.id = coach_comments.athlete_id
      AND stl.staff_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN staff_team_links stl ON stl.team_id = u.team_id
      WHERE u.id = coach_comments.athlete_id
      AND stl.staff_user_id = auth.uid()
    )
  );

-- 8. achievement_milestones テーブル
CREATE TABLE IF NOT EXISTS achievement_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  milestone_type text NOT NULL,
  title text NOT NULL,
  description text,
  achieved_value numeric,
  celebrated boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE achievement_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own milestones"
  ON achievement_milestones FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_type ON user_streaks(user_id, streak_type);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_level ON user_points(current_level DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned ON user_badges(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(status);
CREATE INDEX IF NOT EXISTS idx_coach_comments_athlete ON coach_comments(athlete_id);
CREATE INDEX IF NOT EXISTS idx_coach_comments_unread ON coach_comments(athlete_id, is_read);
CREATE INDEX IF NOT EXISTS idx_achievement_milestones_user_id ON achievement_milestones(user_id);

-- 初期バッジデータの挿入
INSERT INTO badges (name, description, icon, category, rarity, criteria, points_reward, sort_order) VALUES
  ('はじめの一歩', '初めての記録を入力', 'Sparkles', 'milestone', 'common', '{"type": "first_record"}', 10, 1),
  ('7日連続', '7日連続で記録を入力', 'Flame', 'streak', 'common', '{"type": "streak", "days": 7}', 50, 2),
  ('30日連続', '30日連続で記録を入力', 'Award', 'streak', 'rare', '{"type": "streak", "days": 30}', 200, 3),
  ('100日連続', '100日連続で記録を入力', 'Trophy', 'streak', 'epic', '{"type": "streak", "days": 100}', 500, 4),
  ('完璧な週', '1週間すべてのメトリクスを記録', 'Star', 'consistency', 'rare', '{"type": "perfect_week"}', 100, 5),
  ('早起き記録者', '朝6時前に記録を入力（10回）', 'Sunrise', 'special', 'rare', '{"type": "early_bird", "count": 10}', 150, 6),
  ('パーソナルベスト', '初めてのパーソナルベスト達成', 'Zap', 'performance', 'common', '{"type": "first_pb"}', 30, 7),
  ('記録マニア', '合計100回の記録を達成', 'Database', 'milestone', 'rare', '{"type": "total_records", "count": 100}', 300, 8),
  ('ACWR優等生', 'ACWRを30日間安全圏に維持', 'Shield', 'consistency', 'epic', '{"type": "acwr_safe", "days": 30}', 400, 9),
  ('チームスピリット', 'チームメイトに10回応援', 'Heart', 'team', 'common', '{"type": "team_support", "count": 10}', 50, 10)
ON CONFLICT (name) DO NOTHING;

-- ビュー: チーム内ランキング（週間記録数）
CREATE OR REPLACE VIEW team_weekly_rankings AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.team_id,
  COUNT(tr.id) as weekly_records,
  RANK() OVER (PARTITION BY u.team_id ORDER BY COUNT(tr.id) DESC) as rank
FROM users u
LEFT JOIN training_records tr ON tr.user_id = u.id 
  AND tr.date >= CURRENT_DATE - INTERVAL '7 days'
WHERE u.role = 'athlete'
GROUP BY u.id, u.name, u.team_id;

-- ビュー: ポイントランキング
CREATE OR REPLACE VIEW team_points_rankings AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.team_id,
  COALESCE(up.total_points, 0) as total_points,
  COALESCE(up.current_level, 1) as current_level,
  RANK() OVER (PARTITION BY u.team_id ORDER BY COALESCE(up.total_points, 0) DESC) as rank
FROM users u
LEFT JOIN user_points up ON up.user_id = u.id
WHERE u.role = 'athlete'
GROUP BY u.id, u.name, u.team_id, up.total_points, up.current_level;

-- 関数: ストリークの更新
CREATE OR REPLACE FUNCTION update_user_streak(
  p_user_id uuid,
  p_streak_type text,
  p_record_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_date date;
  v_current_streak integer;
  v_longest_streak integer;
BEGIN
  -- 既存のストリークを取得
  SELECT last_recorded_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id AND streak_type = p_streak_type;

  -- レコードが存在しない場合は新規作成
  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak, last_recorded_date, total_records)
    VALUES (p_user_id, p_streak_type, 1, 1, p_record_date, 1);
    RETURN;
  END IF;

  -- 同じ日の記録は無視
  IF v_last_date = p_record_date THEN
    RETURN;
  END IF;

  -- 連続性をチェック
  IF v_last_date = p_record_date - INTERVAL '1 day' THEN
    -- 連続記録
    v_current_streak := v_current_streak + 1;
    v_longest_streak := GREATEST(v_longest_streak, v_current_streak);
  ELSIF v_last_date < p_record_date - INTERVAL '1 day' THEN
    -- ストリークが途切れた
    v_current_streak := 1;
  END IF;

  -- 更新
  UPDATE user_streaks
  SET 
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_recorded_date = p_record_date,
    total_records = total_records + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND streak_type = p_streak_type;
END;
$$;

-- 関数: ポイント付与
CREATE OR REPLACE FUNCTION award_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_category text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_points integer;
  v_current_level integer;
  v_new_level integer;
  v_points_for_next integer;
BEGIN
  -- ポイント履歴を記録
  INSERT INTO point_transactions (user_id, points, reason, category, metadata)
  VALUES (p_user_id, p_points, p_reason, p_category, p_metadata);

  -- user_pointsの初期化または更新
  INSERT INTO user_points (user_id, total_points)
  VALUES (p_user_id, p_points)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_points = user_points.total_points + p_points,
    updated_at = now();

  -- 現在の合計ポイントとレベルを取得
  SELECT total_points, current_level
  INTO v_total_points, v_current_level
  FROM user_points
  WHERE user_id = p_user_id;

  -- レベル計算（100ポイントごとに1レベルアップ、レベルが上がるごとに必要ポイント増加）
  v_new_level := 1;
  v_points_for_next := 100;
  
  WHILE v_total_points >= v_points_for_next LOOP
    v_new_level := v_new_level + 1;
    v_points_for_next := v_points_for_next + (v_new_level * 50);
  END LOOP;

  -- レベルとランクタイトルの更新
  UPDATE user_points
  SET 
    current_level = v_new_level,
    points_to_next_level = v_points_for_next - v_total_points,
    rank_title = CASE
      WHEN v_new_level >= 50 THEN 'レジェンド'
      WHEN v_new_level >= 40 THEN 'マスター'
      WHEN v_new_level >= 30 THEN 'エキスパート'
      WHEN v_new_level >= 20 THEN 'ベテラン'
      WHEN v_new_level >= 10 THEN 'アドバンス'
      WHEN v_new_level >= 5 THEN 'インターミディエイト'
      ELSE 'ビギナー'
    END,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 関数: バッジ獲得
CREATE OR REPLACE FUNCTION earn_badge(
  p_user_id uuid,
  p_badge_name text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge_id uuid;
  v_points_reward integer;
  v_already_earned boolean;
BEGIN
  -- バッジIDとポイント報酬を取得
  SELECT id, points_reward
  INTO v_badge_id, v_points_reward
  FROM badges
  WHERE name = p_badge_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- すでに獲得済みかチェック
  SELECT EXISTS(
    SELECT 1 FROM user_badges 
    WHERE user_id = p_user_id AND badge_id = v_badge_id
  ) INTO v_already_earned;

  IF v_already_earned THEN
    RETURN false;
  END IF;

  -- バッジを付与
  INSERT INTO user_badges (user_id, badge_id, metadata)
  VALUES (p_user_id, v_badge_id, p_metadata);

  -- ポイントを付与
  IF v_points_reward > 0 THEN
    PERFORM award_points(
      p_user_id, 
      v_points_reward, 
      'バッジ獲得: ' || p_badge_name,
      'achievement',
      jsonb_build_object('badge_name', p_badge_name)
    );
  END IF;

  RETURN true;
END;
$$;
