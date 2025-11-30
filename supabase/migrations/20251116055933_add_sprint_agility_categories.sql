/*
  # スプリント・アジリティカテゴリーの追加

  ## 概要
  スプリント系とアジリティ系の測定カテゴリーを追加します。
  これらの測定は専門業者による測定が必要ですが、測定項目を表示して
  どのような測定があるかを示します。

  ## 新規カテゴリー

  ### 1. スプリントカテゴリー
  - 5m走、10m走、15m走、20m走、30m走、50m走
  - すべて専門業者測定（user_can_input = false）

  ### 2. アジリティカテゴリー
  - 反復横跳び（個人入力可能）
  - プロアジリティ（専門業者測定）
  - アローヘッドアジリティ（専門業者測定）

  ## セキュリティ
  - 既存のRLSポリシーを維持
*/

-- 1. スプリントカテゴリーの追加
INSERT INTO performance_categories (name, display_name, description, icon, sort_order)
VALUES
  ('sprint', 'スプリント', '短距離走による速度測定テスト。加速力とトップスピードを評価します。', 'zap', 4)
ON CONFLICT (name) DO NOTHING;

-- 2. アジリティカテゴリーの追加
INSERT INTO performance_categories (name, display_name, description, icon, sort_order)
VALUES
  ('agility', 'アジリティ', '方向転換や素早い動きを測定するテスト。敏捷性と反応速度を評価します。', 'shuffle', 5)
ON CONFLICT (name) DO NOTHING;

-- 3. スプリント測定種目を追加
DO $$
DECLARE
  sprint_category_id uuid;
BEGIN
  SELECT id INTO sprint_category_id FROM performance_categories WHERE name = 'sprint';

  -- 5m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_5m',
    '5m走',
    '5mを全力で走り、タイムを測定します。初速と加速力の指標です。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 0.5, "max": 5, "step": 0.01}
    ]'::jsonb,
    1
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 10m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_10m',
    '10m走',
    '10mを全力で走り、タイムを測定します。加速局面の評価に使用します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 1.0, "max": 5, "step": 0.01}
    ]'::jsonb,
    2
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 15m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_15m',
    '15m走',
    '15mを全力で走り、タイムを測定します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 1.5, "max": 6, "step": 0.01}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 20m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_20m',
    '20m走',
    '20mを全力で走り、タイムを測定します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 2.0, "max": 7, "step": 0.01}
    ]'::jsonb,
    4
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 30m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_30m',
    '30m走',
    '30mを全力で走り、タイムを測定します。最大スピード到達局面の評価に使用します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 3.0, "max": 10, "step": 0.01}
    ]'::jsonb,
    5
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- 50m走
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    sprint_category_id,
    'sprint_50m',
    '50m走',
    '50mを全力で走り、タイムを測定します。トップスピードとスピード維持能力を評価します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 5.0, "max": 15, "step": 0.01}
    ]'::jsonb,
    6
  )
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- 4. アジリティ測定種目を追加
DO $$
DECLARE
  agility_category_id uuid;
BEGIN
  SELECT id INTO agility_category_id FROM performance_categories WHERE name = 'agility';

  -- 反復横跳び
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    agility_category_id,
    'side_step_test',
    '反復横跳び',
    '20秒間で中央ラインを挟んで左右に何回移動できるかを測定します。サイドステップの敏捷性を評価します。',
    '回',
    true,
    true,
    '[
      {"name": "count", "label": "回数", "type": "number", "unit": "回", "required": true, "min": 10, "max": 100}
    ]'::jsonb,
    1
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- プロアジリティ
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    agility_category_id,
    'pro_agility',
    'プロアジリティ（5-10-5）',
    '5ヤード-10ヤード-5ヤードの往復走。方向転換能力と加速力を評価します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 3.0, "max": 10, "step": 0.01}
    ]'::jsonb,
    2
  )
  ON CONFLICT (category_id, name) DO NOTHING;

  -- アローヘッドアジリティ
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, user_can_input, fields, sort_order)
  VALUES (
    agility_category_id,
    'arrowhead_agility',
    'アローヘッドアジリティ',
    '矢印型のコースを走行し、複数方向への方向転換能力を評価します。',
    '秒',
    false,
    false,
    '[
      {"name": "time", "label": "タイム", "type": "number", "unit": "秒", "required": true, "min": 5.0, "max": 20, "step": 0.01}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;
