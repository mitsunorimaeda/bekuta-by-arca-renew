/*
  # パフォーマンス測定システムの拡張：入力制限と新カテゴリー追加

  ## 概要
  測定種目の入力制御を実装し、全身持久力と筋力カテゴリーを追加します。
  専門業者測定が必要な種目は個人入力を制限します。

  ## テーブル変更

  ### 1. performance_test_types テーブル
  - `user_can_input` (boolean): 個人で入力可能かどうか
    - true: 個人で測定・入力可能（メジャーや回数で測定できるもの）
    - false: 専門業者による測定が必要（専用機器が必要なもの）

  ## 新規カテゴリー

  ### 2. 全身持久力カテゴリー
  - クーパーテスト（12分間走行距離）
  - 1500m走（タイム）
  - ビープテスト/ヨーヨーテスト（レベル・回数）
  ※ 各種目からVO2max（最大酸素摂取量）を推定計算

  ### 3. 筋力カテゴリー
  - ベンチプレス（重量・回数）
  - バックスクワット（重量・回数）
  - デッドリフト（重量・回数）
  ※ Epley式で1RM（最大挙上重量）を計算

  ## 既存種目の更新
  - 立ち幅跳び、立ち5段跳び: user_can_input = true（個人入力可能）
  - CMJ、DJ RSI、RJ RSI: user_can_input = false（専門業者測定）

  ## セキュリティ
  - 既存のRLSポリシーを維持
  - 入力制限はUIレベルで制御（専門業者は管理画面から入力）
*/

-- 1. performance_test_types テーブルに user_can_input カラムを追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_test_types' AND column_name = 'user_can_input'
  ) THEN
    ALTER TABLE performance_test_types ADD COLUMN user_can_input boolean DEFAULT true;
  END IF;
END $$;

-- 2. 既存のジャンプ系種目の入力制限を設定
UPDATE performance_test_types
SET user_can_input = false
WHERE name IN ('cmj', 'dj_rsi', 'rj_rsi');

UPDATE performance_test_types
SET user_can_input = true
WHERE name IN ('standing_long_jump', 'standing_five_jump');

-- 3. 全身持久力カテゴリーの追加
INSERT INTO performance_categories (name, display_name, description, icon, sort_order)
VALUES
  ('endurance', '全身持久力', '心肺機能と持久力を測定するテスト。VO2max（最大酸素摂取量）を推定します。', 'heart', 2)
ON CONFLICT (name) DO NOTHING;

-- 4. 筋力カテゴリーの追加
INSERT INTO performance_categories (name, display_name, description, icon, sort_order)
VALUES
  ('strength', '筋力', '最大筋力を測定するテスト。1RM（最大挙上重量）を推定します。', 'dumbbell', 3)
ON CONFLICT (name) DO NOTHING;

-- 5. 全身持久力の測定種目を追加
DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  -- クーパーテスト（12分間走）
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    'cooper_test',
    'クーパーテスト（12分間走）',
    '12分間でできるだけ遠くまで走り、距離を測定します。心肺機能の指標となります。',
    'm',
    true,
    true,
    '[
      {"name": "distance", "label": "走行距離", "type": "number", "unit": "m", "required": true, "min": 1000, "max": 5000}
    ]'::jsonb,
    1
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 1500m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    '1500m_run',
    '1500m走',
    '1500mを全力で走り、タイムを測定します。持久力の基本的な指標です。',
    '秒',
    false,
    true,
    '[
      {"name": "minutes", "label": "分", "type": "number", "unit": "分", "required": true, "min": 0, "max": 30},
      {"name": "seconds", "label": "秒", "type": "number", "unit": "秒", "required": true, "min": 0, "max": 59}
    ]'::jsonb,
    2
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- ビープテスト / ヨーヨーテスト
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    'beep_test',
    'ビープテスト / ヨーヨーテスト',
    '音に合わせて20m区間を往復走します。レベルが上がるごとにペースが速くなります。',
    'レベル',
    true,
    true,
    '[
      {"name": "level", "label": "到達レベル", "type": "number", "unit": "レベル", "required": true, "min": 1, "max": 21},
      {"name": "shuttle", "label": "シャトル数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 16}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- 6. 筋力測定種目を追加
DO $$
DECLARE
  strength_category_id uuid;
BEGIN
  SELECT id INTO strength_category_id FROM performance_categories WHERE name = 'strength';

  -- ベンチプレス
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    strength_category_id,
    'bench_press',
    'ベンチプレス',
    '仰向けでバーベルを胸まで下ろし、押し上げる動作。上半身の押す力を測定します。',
    'kg',
    true,
    true,
    '[
      {"name": "weight", "label": "使用重量", "type": "number", "unit": "kg", "required": true, "min": 0, "max": 500, "step": 0.5},
      {"name": "reps", "label": "反復回数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 30}
    ]'::jsonb,
    1
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- バックスクワット
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    strength_category_id,
    'back_squat',
    'バックスクワット',
    '肩にバーベルを担ぎ、しゃがんで立ち上がる動作。下半身の筋力を測定します。',
    'kg',
    true,
    true,
    '[
      {"name": "weight", "label": "使用重量", "type": "number", "unit": "kg", "required": true, "min": 0, "max": 500, "step": 0.5},
      {"name": "reps", "label": "反復回数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 30}
    ]'::jsonb,
    2
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- デッドリフト
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    strength_category_id,
    'deadlift',
    'デッドリフト',
    '床に置いたバーベルを持ち上げる動作。全身の筋力、特に背中と下半身を測定します。',
    'kg',
    true,
    true,
    '[
      {"name": "weight", "label": "使用重量", "type": "number", "unit": "kg", "required": true, "min": 0, "max": 500, "step": 0.5},
      {"name": "reps", "label": "反復回数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 30}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;
