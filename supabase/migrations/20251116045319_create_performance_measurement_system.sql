/*
  # パフォーマンス測定システムの構築
  
  ## 概要
  アスリートの成長を可視化するためのパフォーマンス測定システムを構築します。
  まずはジャンプ系測定（CMJ、DJ RSI、RJ RSI、立ち幅跳び、立ち5段跳び）を完全実装します。
  
  ## 新規テーブル
  
  ### 1. performance_categories（測定カテゴリーマスタ）
  - `id` (uuid, primary key): カテゴリーID
  - `name` (text): カテゴリー名（例: ジャンプ、スプリント）
  - `display_name` (text): 表示名（日本語）
  - `description` (text): 説明
  - `icon` (text): アイコン名
  - `sort_order` (integer): 表示順序
  - `is_active` (boolean): 有効フラグ
  - `created_at` (timestamptz): 作成日時
  
  ### 2. performance_test_types（測定種目マスタ）
  - `id` (uuid, primary key): 測定種目ID
  - `category_id` (uuid): カテゴリーID（外部キー）
  - `name` (text): 種目名（英語）
  - `display_name` (text): 表示名（日本語）
  - `description` (text): 説明
  - `unit` (text): 単位（cm、秒、回など）
  - `higher_is_better` (boolean): 数値が高い方が良い記録か
  - `fields` (jsonb): 測定項目の定義（柔軟な構造）
  - `sort_order` (integer): 表示順序
  - `is_active` (boolean): 有効フラグ
  - `created_at` (timestamptz): 作成日時
  
  ### 3. performance_records（測定記録）
  - `id` (uuid, primary key): 記録ID
  - `user_id` (uuid): ユーザーID（外部キー）
  - `test_type_id` (uuid): 測定種目ID（外部キー）
  - `date` (date): 測定日
  - `values` (jsonb): 測定値（柔軟な構造）
  - `notes` (text): メモ
  - `is_official` (boolean): 公式測定かどうか
  - `weather_conditions` (text): 天候
  - `created_at` (timestamptz): 作成日時
  - `updated_at` (timestamptz): 更新日時
  
  ### 4. personal_bests（ビュー：自己ベスト記録）
  各測定種目の最高記録を自動抽出するビュー
  
  ## セキュリティ
  - 全テーブルでRLSを有効化
  - アスリートは自分の記録のみ閲覧・編集可能
  - コーチは担当チームのアスリート記録を閲覧可能
*/

-- 1. performance_categories テーブル作成
CREATE TABLE IF NOT EXISTS performance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'activity',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. performance_test_types テーブル作成
CREATE TABLE IF NOT EXISTS performance_test_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES performance_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  unit text NOT NULL,
  higher_is_better boolean DEFAULT true,
  fields jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category_id, name)
);

-- 3. performance_records テーブル作成
CREATE TABLE IF NOT EXISTS performance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_type_id uuid NOT NULL REFERENCES performance_test_types(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  values jsonb NOT NULL,
  notes text DEFAULT '',
  is_official boolean DEFAULT true,
  weather_conditions text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_performance_records_user_id ON performance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_records_test_type_id ON performance_records(test_type_id);
CREATE INDEX IF NOT EXISTS idx_performance_records_date ON performance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_records_user_test ON performance_records(user_id, test_type_id);
CREATE INDEX IF NOT EXISTS idx_performance_records_values ON performance_records USING gin(values);

-- RLS有効化
ALTER TABLE performance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_records ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: performance_categories（全ユーザーが閲覧可能）
CREATE POLICY "Anyone can view active performance categories"
  ON performance_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLSポリシー: performance_test_types（全ユーザーが閲覧可能）
CREATE POLICY "Anyone can view active performance test types"
  ON performance_test_types FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLSポリシー: performance_records（アスリート - 自分の記録を管理）
CREATE POLICY "Athletes can view own performance records"
  ON performance_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Athletes can insert own performance records"
  ON performance_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Athletes can update own performance records"
  ON performance_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Athletes can delete own performance records"
  ON performance_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLSポリシー: performance_records（コーチ - 担当チームの記録を閲覧）
CREATE POLICY "Staff can view team member performance records"
  ON performance_records FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );

-- マスタデータ投入: ジャンプカテゴリー
INSERT INTO performance_categories (name, display_name, description, icon, sort_order)
VALUES 
  ('jump', 'ジャンプ', 'パワー・爆発力を測定するジャンプ系テスト', 'zap', 1)
ON CONFLICT (name) DO NOTHING;

-- マスタデータ投入: ジャンプ測定種目
DO $$
DECLARE
  jump_category_id uuid;
BEGIN
  SELECT id INTO jump_category_id FROM performance_categories WHERE name = 'jump';
  
  -- CMJ（カウンタームーブメントジャンプ）
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, fields, sort_order)
  VALUES (
    jump_category_id,
    'cmj',
    'CMJ（カウンタームーブメントジャンプ）',
    '反動を使った垂直跳び。下肢のパワーを測定します。',
    'cm',
    true,
    '[
      {"name": "height", "label": "跳躍高", "type": "number", "unit": "cm", "required": true, "min": 0, "max": 200}
    ]'::jsonb,
    1
  )
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- DJ RSI（ドロップジャンプ反応筋力指数）
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, fields, sort_order)
  VALUES (
    jump_category_id,
    'dj_rsi',
    'DJ RSI（ドロップジャンプ）',
    '高所から着地して即座にジャンプ。接地時間と跳躍高からRSI（Reactive Strength Index）を算出します。',
    'RSI',
    true,
    '[
      {"name": "height", "label": "跳躍高", "type": "number", "unit": "cm", "required": true, "min": 0, "max": 200},
      {"name": "contact_time", "label": "接地時間", "type": "number", "unit": "ms", "required": true, "min": 0, "max": 2000},
      {"name": "drop_height", "label": "ドロップ高", "type": "number", "unit": "cm", "required": false, "min": 0, "max": 100}
    ]'::jsonb,
    2
  )
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- RJ RSI（リバウンドジャンプ反応筋力指数）
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, fields, sort_order)
  VALUES (
    jump_category_id,
    'rj_rsi',
    'RJ RSI（リバウンドジャンプ）',
    '連続ジャンプテスト。5回または10回の連続ジャンプの平均RSIを算出します。',
    'RSI',
    true,
    '[
      {"name": "avg_height", "label": "平均跳躍高", "type": "number", "unit": "cm", "required": true, "min": 0, "max": 200},
      {"name": "avg_contact_time", "label": "平均接地時間", "type": "number", "unit": "ms", "required": true, "min": 0, "max": 2000},
      {"name": "jumps_count", "label": "ジャンプ回数", "type": "number", "unit": "回", "required": false, "min": 5, "max": 10}
    ]'::jsonb,
    3
  )
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- 立ち幅跳び
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, fields, sort_order)
  VALUES (
    jump_category_id,
    'standing_long_jump',
    '立ち幅跳び',
    '両足で踏み切り、前方へ跳ぶ水平ジャンプ。下肢の総合的なパワーを測定します。',
    'cm',
    true,
    '[
      {"name": "distance", "label": "距離", "type": "number", "unit": "cm", "required": true, "min": 0, "max": 500}
    ]'::jsonb,
    4
  )
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- 立ち5段跳び
  INSERT INTO performance_test_types (category_id, name, display_name, description, unit, higher_is_better, fields, sort_order)
  VALUES (
    jump_category_id,
    'standing_five_jump',
    '立ち5段跳び',
    '片足ずつ交互に5回跳び、到達距離を測定。連続的なパワー発揮能力を評価します。',
    'cm',
    true,
    '[
      {"name": "distance", "label": "距離", "type": "number", "unit": "cm", "required": true, "min": 0, "max": 2000}
    ]'::jsonb,
    5
  )
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- personal_bests ビュー作成（各測定種目の自己ベストを抽出）
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

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_performance_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER performance_records_updated_at
  BEFORE UPDATE ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_records_updated_at();
