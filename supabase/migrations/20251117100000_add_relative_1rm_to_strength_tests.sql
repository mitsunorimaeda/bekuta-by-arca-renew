/*
  # 筋力測定に相対1RM（体重比）を追加

  ## 概要
  ベンチプレス、スクワット、デッドリフトの1RM測定時に、
  最新の体重記録を使用して相対1RM（1RM ÷ 体重）を自動計算・保存します。

  ## 変更内容
  1. performance_recordsテーブルに処理は不要（valuesがJSONBで柔軟）
  2. 相対1RMを計算して保存する関数を作成
  3. フロントエンドで使用するためのヘルパー関数を追加

  ## 計算方法
  - 相対1RM = 1RM (kg) ÷ 体重 (kg)
  - 例: 1RM 100kg、体重 70kg の場合、相対1RM = 1.43
  - 体重記録がない場合は、相対1RMはnullとして保存

  ## 使用方法
  フロントエンド（React）側で以下のように実装：
  1. 筋力測定の入力フォームで1RM値を入力
  2. useWeightData hookで最新体重を取得
  3. 相対1RMを計算: relative_1rm = 1rm / latest_weight
  4. performance_records.valuesに以下の構造で保存:
     {
       "primary_value": 100,      // 1RM (kg)
       "relative_1rm": 1.43,      // 相対1RM（体重記録がある場合）
       "weight_at_test": 70       // 測定時の体重（参照用）
     }

  ## 注意事項
  - 既存の記録には影響しません
  - 相対1RMは表示時に計算することも可能ですが、
    測定時の体重を記録として残すため保存します
*/

-- 筋力測定種目の取得（後続の処理で使用）
DO $$
DECLARE
  strength_category_id uuid;
BEGIN
  -- 筋力カテゴリーのIDを取得
  SELECT id INTO strength_category_id
  FROM performance_categories
  WHERE name = 'strength'
  LIMIT 1;

  -- 筋力カテゴリーが存在しない場合は終了
  IF strength_category_id IS NULL THEN
    RAISE NOTICE '筋力カテゴリーが見つかりません。先に筋力測定システムを作成してください。';
    RETURN;
  END IF;

  -- ベンチプレス、スクワット、デッドリフトのfields定義を更新
  -- 説明に相対1RMの計算方法を追記
  UPDATE performance_test_types
  SET description = description || E'\n\n相対1RM（体重比）: 測定時の最新体重記録を使用して、1RM ÷ 体重 で自動計算されます。'
  WHERE category_id = strength_category_id
    AND name IN ('bench_press', 'squat', 'deadlift')
    AND description NOT LIKE '%相対1RM%';

  RAISE NOTICE '筋力測定種目の説明を更新しました。';
END $$;

-- 最新体重を取得する関数（フロントエンドでも使用可能）
CREATE OR REPLACE FUNCTION get_latest_weight(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  latest_weight numeric;
BEGIN
  SELECT weight
  INTO latest_weight
  FROM weight_records
  WHERE user_id = p_user_id
  ORDER BY date DESC, created_at DESC
  LIMIT 1;

  RETURN latest_weight;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 相対1RMを計算する関数
CREATE OR REPLACE FUNCTION calculate_relative_1rm(p_1rm numeric, p_weight numeric)
RETURNS numeric AS $$
BEGIN
  IF p_weight IS NULL OR p_weight = 0 THEN
    RETURN NULL;
  END IF;

  -- 小数点第2位まで丸める
  RETURN ROUND(p_1rm / p_weight, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 筋力測定記録に相対1RMを追加するヘルパー関数
-- フロントエンドから呼び出すことも可能
CREATE OR REPLACE FUNCTION add_strength_record_with_relative_1rm(
  p_user_id uuid,
  p_test_type_id uuid,
  p_date date,
  p_1rm numeric,
  p_notes text DEFAULT '',
  p_is_official boolean DEFAULT true
)
RETURNS uuid AS $$
DECLARE
  v_latest_weight numeric;
  v_relative_1rm numeric;
  v_values jsonb;
  v_record_id uuid;
BEGIN
  -- 最新の体重を取得
  v_latest_weight := get_latest_weight(p_user_id);

  -- 相対1RMを計算
  v_relative_1rm := calculate_relative_1rm(p_1rm, v_latest_weight);

  -- values JSONBを構築
  v_values := jsonb_build_object(
    'primary_value', p_1rm,
    'relative_1rm', v_relative_1rm,
    'weight_at_test', v_latest_weight
  );

  -- 記録を挿入
  INSERT INTO performance_records (
    user_id,
    test_type_id,
    date,
    values,
    notes,
    is_official
  )
  VALUES (
    p_user_id,
    p_test_type_id,
    p_date,
    v_values,
    p_notes,
    p_is_official
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: 関数へのアクセス権限
-- 認証済みユーザーのみが自分の記録を追加できる
GRANT EXECUTE ON FUNCTION get_latest_weight(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_relative_1rm(numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION add_strength_record_with_relative_1rm(uuid, uuid, date, numeric, text, boolean) TO authenticated;

-- personal_bestsビューを更新（相対1RMも表示）
DROP VIEW IF EXISTS personal_bests;
CREATE OR REPLACE VIEW personal_bests AS
SELECT DISTINCT ON (pr.user_id, pr.test_type_id)
  pr.id,
  pr.user_id,
  pr.test_type_id,
  ptt.name as test_name,
  ptt.display_name as test_display_name,
  ptt.unit,
  ptt.higher_is_better,
  pr.date,
  pr.values,
  (pr.values->>'primary_value')::numeric as primary_value,
  (pr.values->>'relative_1rm')::numeric as relative_1rm,
  (pr.values->>'weight_at_test')::numeric as weight_at_test,
  pr.created_at
FROM performance_records pr
JOIN performance_test_types ptt ON pr.test_type_id = ptt.id
ORDER BY
  pr.user_id,
  pr.test_type_id,
  CASE
    WHEN ptt.higher_is_better THEN (pr.values->>'primary_value')::numeric
    ELSE -(pr.values->>'primary_value')::numeric
  END DESC NULLS LAST;

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_weight_records_user_date ON weight_records(user_id, date DESC);
