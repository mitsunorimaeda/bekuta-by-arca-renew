/*
  # コーチスタッフ向けレポートシステムの作成

  ## 概要
  コーチスタッフが選手のコンディション、トレーニング負荷、怪我リスクを総合的に把握できる
  レポート機能を実装します。自動生成、メール配信、PDF出力に対応します。

  ## 新規テーブル
  
  ### 1. report_configs - レポート設定
  - レポートのテンプレート設定（期間、含めるデータ項目）
  - 組織単位またはコーチ個人の設定
  
  ### 2. report_schedules - レポートスケジュール
  - 自動生成のスケジュール設定（週次、月次など）
  - 配信先コーチの設定
  
  ### 3. generated_reports - 生成済みレポート履歴
  - 生成されたレポートの記録
  - レポートデータのJSON保存
  - 再閲覧可能
  
  ### 4. report_subscriptions - レポート配信設定
  - コーチごとの受信設定
  - メール配信のオン/オフ
  
  ## セキュリティ
  - RLS有効化：全テーブル
  - コーチは担当チームのレポートのみアクセス可能
  - 管理者は全レポートにアクセス可能
  
  ## インデックス
  - パフォーマンス最適化のための適切なインデックス設定
*/

-- =====================================================
-- 1. report_configs テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- レポート期間設定
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
  
  -- 含めるデータ項目
  include_training_load boolean DEFAULT true,
  include_acwr boolean DEFAULT true,
  include_weight boolean DEFAULT true,
  include_sleep boolean DEFAULT true,
  include_motivation boolean DEFAULT true,
  include_performance boolean DEFAULT true,
  include_alerts boolean DEFAULT true,
  
  -- 追加設定
  compare_with_previous boolean DEFAULT true,
  include_team_average boolean DEFAULT true,
  highlight_high_risk boolean DEFAULT true,
  
  -- メタデータ
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. report_schedules テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES report_configs(id) ON DELETE CASCADE NOT NULL,
  
  -- スケジュール設定
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual')),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),
  time_of_day time DEFAULT '06:00:00', -- 朝6時がデフォルト
  
  -- 配信設定
  send_email boolean DEFAULT true,
  save_to_history boolean DEFAULT true,
  
  -- 次回実行予定
  next_run_at timestamptz,
  last_run_at timestamptz,
  
  -- ステータス
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. generated_reports テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES report_configs(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES report_schedules(id) ON DELETE SET NULL,
  
  -- レポート基本情報
  report_type text NOT NULL,
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- 対象
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  athlete_ids uuid[] DEFAULT ARRAY[]::uuid[],
  
  -- レポートデータ
  summary_data jsonb NOT NULL DEFAULT '{}',
  detailed_data jsonb NOT NULL DEFAULT '{}',
  insights jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  
  -- ファイル
  pdf_url text,
  
  -- ステータス
  generation_status text DEFAULT 'completed' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  error_message text,
  
  -- メタデータ
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz DEFAULT now(),
  viewed_at timestamptz,
  view_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 4. report_subscriptions テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  config_id uuid REFERENCES report_configs(id) ON DELETE CASCADE NOT NULL,
  
  -- 受信設定
  receive_email boolean DEFAULT true,
  email_address text,
  
  -- 通知設定
  notify_on_generation boolean DEFAULT true,
  notify_on_high_risk boolean DEFAULT true,
  
  -- ステータス
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, config_id)
);

-- =====================================================
-- インデックス作成
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_report_configs_org ON report_configs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_configs_team ON report_configs(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_configs_active ON report_configs(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_schedules_config ON report_schedules(config_id);

CREATE INDEX IF NOT EXISTS idx_generated_reports_org ON generated_reports(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_team ON generated_reports(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_period ON generated_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON generated_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_subscriptions_user ON report_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_config ON report_subscriptions(config_id);

-- =====================================================
-- RLS ポリシー設定
-- =====================================================

-- report_configs
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理者は全レポート設定を閲覧可能"
  ON report_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "コーチは担当組織・チームのレポート設定を閲覧可能"
  ON report_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'staff'
      AND (
        -- 組織のメンバー
        (report_configs.organization_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.user_id = auth.uid()
          AND organization_members.organization_id = report_configs.organization_id
        ))
        OR
        -- チームのスタッフ
        (report_configs.team_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM staff_team_links
          WHERE staff_team_links.staff_user_id = auth.uid()
          AND staff_team_links.team_id = report_configs.team_id
        ))
      )
    )
  );

CREATE POLICY "管理者とコーチはレポート設定を作成可能"
  ON report_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "管理者とコーチはレポート設定を更新可能"
  ON report_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

-- report_schedules
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理者は全レポートスケジュールを閲覧可能"
  ON report_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "コーチは担当のレポートスケジュールを閲覧可能"
  ON report_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM report_configs
      WHERE report_configs.id = report_schedules.config_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'staff'
          AND (
            (report_configs.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM organization_members
              WHERE organization_members.user_id = auth.uid()
              AND organization_members.organization_id = report_configs.organization_id
            ))
            OR
            (report_configs.team_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM staff_team_links
              WHERE staff_team_links.staff_user_id = auth.uid()
              AND staff_team_links.team_id = report_configs.team_id
            ))
          )
        )
      )
    )
  );

CREATE POLICY "管理者とコーチはレポートスケジュールを作成・更新可能"
  ON report_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

-- generated_reports
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理者は全レポートを閲覧可能"
  ON generated_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "コーチは担当チームのレポートを閲覧可能"
  ON generated_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'staff'
      AND (
        -- 組織のメンバー
        (generated_reports.organization_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.user_id = auth.uid()
          AND organization_members.organization_id = generated_reports.organization_id
        ))
        OR
        -- チームのスタッフ
        (generated_reports.team_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM staff_team_links
          WHERE staff_team_links.staff_user_id = auth.uid()
          AND staff_team_links.team_id = generated_reports.team_id
        ))
      )
    )
  );

CREATE POLICY "システムとコーチはレポートを作成可能"
  ON generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "システムはレポートを更新可能"
  ON generated_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

-- report_subscriptions
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の配信設定を閲覧可能"
  ON report_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "管理者は全配信設定を閲覧可能"
  ON report_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "ユーザーは自分の配信設定を作成・更新可能"
  ON report_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- トリガー: updated_at自動更新
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_report_configs_updated_at'
  ) THEN
    CREATE TRIGGER update_report_configs_updated_at
      BEFORE UPDATE ON report_configs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_report_schedules_updated_at'
  ) THEN
    CREATE TRIGGER update_report_schedules_updated_at
      BEFORE UPDATE ON report_schedules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_report_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_report_subscriptions_updated_at
      BEFORE UPDATE ON report_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- トリガー: レポート閲覧カウント更新
-- =====================================================
CREATE OR REPLACE FUNCTION increment_report_view_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.viewed_at IS NOT NULL AND (OLD.viewed_at IS NULL OR NEW.viewed_at <> OLD.viewed_at) THEN
    NEW.view_count = OLD.view_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'increment_generated_reports_view_count'
  ) THEN
    CREATE TRIGGER increment_generated_reports_view_count
      BEFORE UPDATE ON generated_reports
      FOR EACH ROW
      EXECUTE FUNCTION increment_report_view_count();
  END IF;
END $$;