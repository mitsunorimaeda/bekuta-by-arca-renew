/*
  # 持久力測定の更新

  ## 概要
  持久力測定の計算式を修正します。

  ## 変更内容

  ### 持久力測定
  - 1500m走: 計算式なし、タイム測定のみ
  - ビープテスト削除 → Yo-Yo Test IR1とIR2に置き換え
  - Yo-Yo Test IR1: VO2max = 距離×0.0084+36.4
  - Yo-Yo Test IR2: VO2max = 距離×0.0136+45.3
  - 20mシャトルラン追加: 男性(回数×0.2+3.7)、女性(回数×0.18+3.5)

  ## セキュリティ
  - 既存のRLSポリシーを維持
*/

-- 1. 既存のビープテストを削除（Yo-Yo Testに置き換え）
DO $$
DECLARE
  endurance_category_id uuid;
  beep_test_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  -- ビープテスト/ヨーヨーテストのIDを取得
  SELECT id INTO beep_test_id
  FROM performance_test_types
  WHERE category_id = endurance_category_id
    AND name = 'beep_test';

  -- もし存在する場合は削除
  IF beep_test_id IS NOT NULL THEN
    DELETE FROM performance_test_types WHERE id = beep_test_id;
  END IF;
END $$;

-- 2. 1500m走の計算式を削除（フィールド定義のみ更新）
DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  UPDATE performance_test_types
  SET
    description = '1500mを走り、タイムを測定します。',
    unit = '秒',
    fields = '[
      {"name": "time_minutes", "label": "分", "type": "number", "unit": "分", "required": true, "min": 0, "max": 20},
      {"name": "time_seconds", "label": "秒", "type": "number", "unit": "秒", "required": true, "min": 0, "max": 59.99, "step": 0.01}
    ]'::jsonb
  WHERE category_id = endurance_category_id
    AND name = '1500m_run';
END $$;

-- 3. Yo-Yo Test IR1を追加
DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    'yoyo_ir1',
    'Yo-Yo Test IR1',
    'Yo-Yo間欠性回復走テストレベル1。走行距離からVO2maxを推定します。計算式: VO2max = 距離×0.0084+36.4',
    'ml/kg/分',
    true,
    true,
    '[
      {"name": "distance", "label": "走行距離", "type": "number", "unit": "m", "required": true, "min": 0, "max": 5000, "step": 20}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    fields = EXCLUDED.fields,
    sort_order = EXCLUDED.sort_order;
END $$;

-- 4. Yo-Yo Test IR2を追加
DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    'yoyo_ir2',
    'Yo-Yo Test IR2',
    'Yo-Yo間欠性回復走テストレベル2。走行距離からVO2maxを推定します。計算式: VO2max = 距離×0.0136+45.3',
    'ml/kg/分',
    true,
    true,
    '[
      {"name": "distance", "label": "走行距離", "type": "number", "unit": "m", "required": true, "min": 0, "max": 3000, "step": 20}
    ]'::jsonb,
    4
  )
  ON CONFLICT (category_id, name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    fields = EXCLUDED.fields,
    sort_order = EXCLUDED.sort_order;
END $$;

-- 5. 20mシャトルランを追加
DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    endurance_category_id,
    'shuttle_run_20m',
    '20mシャトルラン',
    '20m間を往復走します。回数と性別からVO2maxを推定します。計算式: 男性(回数×0.2+3.7)、女性(回数×0.18+3.5)',
    'ml/kg/分',
    true,
    true,
    '[
      {"name": "count", "label": "往復回数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 200},
      {"name": "gender", "label": "性別", "type": "select", "options": [{"value": "male", "label": "男性"}, {"value": "female", "label": "女性"}], "required": true}
    ]'::jsonb,
    5
  )
  ON CONFLICT (category_id, name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    fields = EXCLUDED.fields,
    sort_order = EXCLUDED.sort_order;
END $$;
