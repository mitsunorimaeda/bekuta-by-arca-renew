-- ================================================
-- Additional Performance Test Types (Athlete Input Allowed)
-- Insert-only / Non-destructive migration
-- Safe to run multiple times (idempotent via ON CONFLICT)
-- ================================================

-- JUMP CATEGORY ID
-- 64407e30-4d21-4fef-afb4-ed828e5c9d79

-- AGILITY CATEGORY ID
-- 5a304257-1d2b-490d-8c79-1f5f0fbfeb20

-- ENDURANCE CATEGORY ID
-- 241e2e55-d0d0-428c-878b-a7b89960fbaa


-- ================================================
-- 🚀 1. スクワットジャンプ（SQJ）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES (
  uuid_generate_v4(),
  '64407e30-4d21-4fef-afb4-ed828e5c9d79',
  'sqj',
  'SQJ（スクワットジャンプ）',
  '反動を使わず、しゃがんだ姿勢から垂直に跳ぶジャンプ。純粋な下肢パワーを測定します。',
  'cm',
  true,
  '[{"name":"height","label":"跳躍高","type":"number","unit":"cm","min":0,"max":200,"required":true}]',
  6,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;


-- ================================================
-- 🚀 2. 腕振り CMJ（CMJ-Arm）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES (
  uuid_generate_v4(),
  '64407e30-4d21-4fef-afb4-ed828e5c9d79',
  'cmj_arm',
  'CMJ（腕振りあり）',
  '腕振りを使用したカウンタームーブメントジャンプ。跳躍高を測定します。',
  'cm',
  true,
  '[{"name":"height","label":"跳躍高","type":"number","unit":"cm","min":0,"max":200,"required":true}]',
  7,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;



-- ================================================
-- 🚀 3. プロアジリティ（右 / 左）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES 
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'pro_agility_right',
  'プロアジリティ（右）',
  '5-10-5 アジリティテスト。右側スタート版。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":10,"required":true}]',
  4,
  true,
  true
),
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'pro_agility_left',
  'プロアジリティ（左）',
  '5-10-5 アジリティテスト。左側スタート版。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":10,"required":true}]',
  5,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;



-- ================================================
-- 🚀 4. 0-5-0（右 / 左）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'zero_5_zero_right',
  '0-5-0（右）',
  '方向転換（右）を含むアジリティテスト。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":15,"required":true}]',
  6,
  true,
  true
),
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'zero_5_zero_left',
  '0-5-0（左）',
  '方向転換（左）を含むアジリティテスト。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":15,"required":true}]',
  7,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;



-- ================================================
-- 🚀 5. アローヘッド（右 / 左）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'arrowhead_agility_right',
  'アローヘッドアジリティ（右）',
  '矢印型コースの敏捷性テスト（右）。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":5,"max":20,"required":true}]',
  8,
  true,
  true
),
(
  uuid_generate_v4(),
  '5a304257-1d2b-490d-8c79-1f5f0fbfeb20',
  'arrowhead_agility_left',
  'アローヘッドアジリティ（左）',
  '矢印型コースの敏捷性テスト（左）。',
  '秒',
  false,
  '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":5,"max":20,"required":true}]',
  9,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;


-- ================================================
-- 🚀 6. 1000m走（追加）
-- ================================================
INSERT INTO performance_test_types (
  id, category_id, name, display_name, description, unit,
  higher_is_better, fields, sort_order, is_active, user_can_input
)
VALUES (
  uuid_generate_v4(),
  '241e2e55-d0d0-428c-878b-a7b89960fbaa',
  '1000m_run',
  '1000m走',
  '1000mを全力で走り、タイムを測定します。',
  '秒',
  false,
  '[{"name":"time_minutes","label":"分","type":"number","unit":"分","min":0,"max":20,"required":true},{"name":"time_seconds","label":"秒","type":"number","unit":"秒","step":0.01,"min":0,"max":59.99,"required":true}]',
  6,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;