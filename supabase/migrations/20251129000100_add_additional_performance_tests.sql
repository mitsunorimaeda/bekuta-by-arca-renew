/*
  Additional Performance Test Types (Athlete Input Allowed)
  - FK-safe: performance_categories を name ベースで確実に取得
  - Idempotent: 何回流しても増殖しない
  - uuid_generate_v4() 不要: gen_random_uuid() を使用
*/

SET search_path = public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- Category "desired" UUIDs (希望ID)
-- JUMP:      64407e30-4d21-4fef-afb4-ed828e5c9d79
-- AGILITY:   5a304257-1d2b-490d-8c79-1f5f0fbfeb20
-- ENDURANCE: 241e2e55-d0d0-428c-878b-a7b89960fbaa
-- ================================================

DO $$
DECLARE
  v_jump_id uuid;
  v_agility_id uuid;
  v_endurance_id uuid;
BEGIN
  -- =========================
  -- Ensure categories by NAME
  -- =========================

  -- JUMP
  SELECT id INTO v_jump_id
  FROM public.performance_categories
  WHERE name = 'jump'
  LIMIT 1;

  IF v_jump_id IS NULL THEN
    INSERT INTO public.performance_categories (
      id, name, display_name, description, icon, sort_order, is_active, created_at
    ) VALUES (
      '64407e30-4d21-4fef-afb4-ed828e5c9d79'::uuid,
      'jump',
      'ジャンプ',
      'ジャンプ能力（SJ/CMJ/DJなど）に関する測定カテゴリ',
      'jump',
      10,
      true,
      now()
    )
    RETURNING id INTO v_jump_id;
  END IF;

  -- AGILITY
  SELECT id INTO v_agility_id
  FROM public.performance_categories
  WHERE name = 'agility'
  LIMIT 1;

  IF v_agility_id IS NULL THEN
    INSERT INTO public.performance_categories (
      id, name, display_name, description, icon, sort_order, is_active, created_at
    ) VALUES (
      '5a304257-1d2b-490d-8c79-1f5f0fbfeb20'::uuid,
      'agility',
      'アジリティ',
      '方向転換・加減速を含む敏捷性テストのカテゴリ',
      'agility',
      20,
      true,
      now()
    )
    RETURNING id INTO v_agility_id;
  END IF;

  -- ENDURANCE
  SELECT id INTO v_endurance_id
  FROM public.performance_categories
  WHERE name = 'endurance'
  LIMIT 1;

  IF v_endurance_id IS NULL THEN
    INSERT INTO public.performance_categories (
      id, name, display_name, description, icon, sort_order, is_active, created_at
    ) VALUES (
      '241e2e55-d0d0-428c-878b-a7b89960fbaa'::uuid,
      'endurance',
      '持久力',
      '持久走・有酸素能力に関する測定カテゴリ',
      'endurance',
      30,
      true,
      now()
    )
    RETURNING id INTO v_endurance_id;
  END IF;

  -- =========================
  -- Insert test types (by name)
  -- =========================

  -- 1) SQJ
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_jump_id,
    'sqj',
    'SQJ（スクワットジャンプ）',
    '反動を使わず、しゃがんだ姿勢から垂直に跳ぶジャンプ。純粋な下肢パワーを測定します。',
    'cm',
    true,
    '[{"name":"height","label":"跳躍高","type":"number","unit":"cm","min":0,"max":200,"required":true}]'::jsonb,
    6,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'sqj');

  -- 2) CMJ-Arm
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_jump_id,
    'cmj_arm',
    'CMJ（腕振りあり）',
    '腕振りを使用したカウンタームーブメントジャンプ。跳躍高を測定します。',
    'cm',
    true,
    '[{"name":"height","label":"跳躍高","type":"number","unit":"cm","min":0,"max":200,"required":true}]'::jsonb,
    7,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'cmj_arm');

  -- 3) Pro Agility Right
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'pro_agility_right',
    'プロアジリティ（右）',
    '5-10-5 アジリティテスト。右側スタート版。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":10,"required":true}]'::jsonb,
    4,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'pro_agility_right');

  -- 4) Pro Agility Left
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'pro_agility_left',
    'プロアジリティ（左）',
    '5-10-5 アジリティテスト。左側スタート版。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":10,"required":true}]'::jsonb,
    5,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'pro_agility_left');

  -- 5) 0-5-0 Right
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'zero_5_zero_right',
    '0-5-0（右）',
    '方向転換（右）を含むアジリティテスト。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":15,"required":true}]'::jsonb,
    6,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'zero_5_zero_right');

  -- 6) 0-5-0 Left
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'zero_5_zero_left',
    '0-5-0（左）',
    '方向転換（左）を含むアジリティテスト。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":3,"max":15,"required":true}]'::jsonb,
    7,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'zero_5_zero_left');

  -- 7) Arrowhead Right
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'arrowhead_agility_right',
    'アローヘッドアジリティ（右）',
    '矢印型コースの敏捷性テスト（右）。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":5,"max":20,"required":true}]'::jsonb,
    8,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'arrowhead_agility_right');

  -- 8) Arrowhead Left
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_agility_id,
    'arrowhead_agility_left',
    'アローヘッドアジリティ（左）',
    '矢印型コースの敏捷性テスト（左）。',
    '秒',
    false,
    '[{"name":"time","label":"タイム","type":"number","unit":"秒","step":0.01,"min":5,"max":20,"required":true}]'::jsonb,
    9,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = 'arrowhead_agility_left');

  -- 9) 1000m
  INSERT INTO public.performance_test_types (
    id, category_id, name, display_name, description,
    unit, higher_is_better, fields, sort_order, is_active, user_can_input
  )
  SELECT
    gen_random_uuid(),
    v_endurance_id,
    '1000m_run',
    '1000m走',
    '1000mを全力で走り、タイムを測定します。',
    '秒',
    false,
    '[{"name":"time_minutes","label":"分","type":"number","unit":"分","min":0,"max":20,"required":true},{"name":"time_seconds","label":"秒","type":"number","unit":"秒","step":0.01,"min":0,"max":59.99,"required":true}]'::jsonb,
    6,
    true,
    true
  WHERE NOT EXISTS (SELECT 1 FROM public.performance_test_types WHERE name = '1000m_run');

  RAISE NOTICE 'Additional performance test types inserted (idempotent).';
END $$;