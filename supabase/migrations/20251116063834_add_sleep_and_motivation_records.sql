/*
  # コンディショニング記録テーブルの追加

  1. 新規テーブル
    - `sleep_records` - 睡眠記録テーブル
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `date` (date, 記録日)
      - `sleep_hours` (numeric, 睡眠時間)
      - `sleep_quality` (integer, 睡眠の質 1-5段階)
      - `bedtime` (time, 就寝時刻)
      - `waketime` (time, 起床時刻)
      - `notes` (text, メモ)
      - `created_at` (timestamptz)
      
    - `motivation_records` - モチベーション記録テーブル
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `date` (date, 記録日)
      - `motivation_level` (integer, モチベーション 1-10段階)
      - `energy_level` (integer, エネルギー 1-10段階)
      - `stress_level` (integer, ストレス 1-10段階)
      - `mood` (text, 気分メモ)
      - `notes` (text, メモ)
      - `created_at` (timestamptz)

  2. セキュリティ
    - 全テーブルでRLSを有効化
    - アスリートは自分のデータのみアクセス可能
    - スタッフは担当チームメンバーのデータを閲覧可能
    - 管理者は全データにアクセス可能
*/

-- 睡眠記録テーブルの作成
CREATE TABLE IF NOT EXISTS sleep_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours numeric(4,2) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  sleep_quality integer CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  bedtime time,
  waketime time,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- モチベーション記録テーブルの作成
CREATE TABLE IF NOT EXISTS motivation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  motivation_level integer NOT NULL CHECK (motivation_level >= 1 AND motivation_level <= 10),
  energy_level integer NOT NULL CHECK (energy_level >= 1 AND energy_level <= 10),
  stress_level integer NOT NULL CHECK (stress_level >= 1 AND stress_level <= 10),
  mood text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 更新日時を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- sleep_recordsテーブルの更新トリガー
DROP TRIGGER IF EXISTS update_sleep_records_updated_at ON sleep_records;
CREATE TRIGGER update_sleep_records_updated_at
  BEFORE UPDATE ON sleep_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- motivation_recordsテーブルの更新トリガー
DROP TRIGGER IF EXISTS update_motivation_records_updated_at ON motivation_records;
CREATE TRIGGER update_motivation_records_updated_at
  BEFORE UPDATE ON motivation_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLSを有効化
ALTER TABLE sleep_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivation_records ENABLE ROW LEVEL SECURITY;

-- sleep_recordsのポリシー設定
CREATE POLICY "Users can view own sleep records"
  ON sleep_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sleep records"
  ON sleep_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sleep records"
  ON sleep_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own sleep records"
  ON sleep_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view team members sleep records"
  ON sleep_records FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );

-- motivation_recordsのポリシー設定
CREATE POLICY "Users can view own motivation records"
  ON motivation_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own motivation records"
  ON motivation_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own motivation records"
  ON motivation_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own motivation records"
  ON motivation_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view team members motivation records"
  ON motivation_records FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );

-- インデックスの作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_sleep_records_user_id ON sleep_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_records_date ON sleep_records(date);
CREATE INDEX IF NOT EXISTS idx_sleep_records_user_date ON sleep_records(user_id, date);

CREATE INDEX IF NOT EXISTS idx_motivation_records_user_id ON motivation_records(user_id);
CREATE INDEX IF NOT EXISTS idx_motivation_records_date ON motivation_records(date);
CREATE INDEX IF NOT EXISTS idx_motivation_records_user_date ON motivation_records(user_id, date);
