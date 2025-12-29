/*
  # 体重記録テーブルの作成

  1. 新しいテーブル
    - `weight_records`
      - `id` (uuid, primary key) - レコードの一意識別子
      - `user_id` (uuid, foreign key) - ユーザーID（usersテーブルへの外部キー）
      - `date` (date) - 体重測定日
      - `weight_kg` (decimal) - 体重（キログラム）
      - `notes` (text, nullable) - メモ（任意）
      - `created_at` (timestamptz) - レコード作成日時

  2. インデックス
    - `user_id`と`date`の複合ユニーク制約（1日1回のみ記録可能）
    - パフォーマンス向上のための`user_id`インデックス

  3. セキュリティ
    - RLSを有効化
    - 認証済みユーザーは自分のデータのみ閲覧可能
    - 認証済みユーザーは自分のデータのみ挿入可能
    - 認証済みユーザーは自分のデータのみ更新可能
    - 認証済みユーザーは自分のデータのみ削除可能

  4. 注意事項
    - 体重は小数点第2位まで記録可能（例: 65.50kg）
    - 日付とユーザーIDの組み合わせは一意でなければならない
*/

-- 体重記録テーブルを作成
CREATE TABLE IF NOT EXISTS weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg decimal(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ユーザーIDと日付の複合ユニーク制約（1日1回のみ記録）
CREATE UNIQUE INDEX IF NOT EXISTS weight_records_user_date_unique 
  ON weight_records(user_id, date);

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS weight_records_user_id_idx 
  ON weight_records(user_id);

CREATE INDEX IF NOT EXISTS weight_records_date_idx 
  ON weight_records(date);

-- RLSを有効化
ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;

-- SELECT: 認証済みユーザーは自分のデータのみ閲覧可能
-- ✅ Policies（重複で落ちないように drop → create）
DROP POLICY IF EXISTS "Users can view own weight records" ON public.weight_records;
CREATE POLICY "Users can view own weight records"
  ON public.weight_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own weight records" ON public.weight_records;
CREATE POLICY "Users can insert own weight records"
  ON public.weight_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own weight records" ON public.weight_records;
CREATE POLICY "Users can update own weight records"
  ON public.weight_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own weight records" ON public.weight_records;
CREATE POLICY "Users can delete own weight records"
  ON public.weight_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);