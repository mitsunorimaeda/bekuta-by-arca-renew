/*
  # Subscription and Billing System

  ## Purpose
  Create comprehensive subscription and billing management system for organizations and individuals.
  Supports multi-tier pricing, usage tracking, billing history, and flexible permission management.

  ## New Tables

  ### `subscription_plans`
  Available subscription plans with features and limits
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, unique, not null) - Plan name (e.g., 'Free', 'Basic', 'Pro', 'Enterprise')
  - `description` (text, default '') - Plan description
  - `price_monthly` (numeric, not null) - Monthly price in currency units
  - `price_yearly` (numeric, not null) - Yearly price (with discount)
  - `athlete_limit` (integer, default null) - Max number of athletes (null = unlimited)
  - `storage_gb` (integer, default 10) - Storage limit in GB
  - `features` (jsonb, default {}) - Feature flags and limits
  - `is_active` (boolean, default true) - Whether plan is available for selection
  - `sort_order` (integer, default 0) - Display order
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `organization_subscriptions`
  Organization-level subscriptions
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization
  - `plan_id` (uuid, not null, fk -> subscription_plans.id) - Current plan
  - `status` (text, not null) - Status: 'active', 'trial', 'expired', 'cancelled'
  - `billing_cycle` (text, not null) - Billing cycle: 'monthly', 'yearly'
  - `current_period_start` (timestamptz, not null) - Current billing period start
  - `current_period_end` (timestamptz, not null) - Current billing period end
  - `trial_end` (timestamptz, default null) - Trial period end date
  - `cancel_at_period_end` (boolean, default false) - Whether to cancel at period end
  - `billing_email` (text, not null) - Email for billing notifications
  - `metadata` (jsonb, default {}) - Additional subscription metadata
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `user_subscriptions`
  Individual user subscriptions (for personal add-ons)
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null, fk -> users.id) - User
  - `plan_id` (uuid, not null, fk -> subscription_plans.id) - Current plan
  - `status` (text, not null) - Status: 'active', 'trial', 'expired', 'cancelled'
  - `billing_cycle` (text, not null) - Billing cycle: 'monthly', 'yearly'
  - `current_period_start` (timestamptz, not null) - Current billing period start
  - `current_period_end` (timestamptz, not null) - Current billing period end
  - `trial_end` (timestamptz, default null) - Trial period end date
  - `cancel_at_period_end` (boolean, default false) - Whether to cancel at period end
  - `metadata` (jsonb, default {}) - Additional subscription metadata
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `usage_tracking`
  Track resource usage for organizations
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization
  - `period_start` (timestamptz, not null) - Tracking period start
  - `period_end` (timestamptz, not null) - Tracking period end
  - `active_athletes` (integer, default 0) - Number of active athletes
  - `total_users` (integer, default 0) - Total users in organization
  - `storage_used_mb` (numeric, default 0) - Storage used in MB
  - `api_calls` (integer, default 0) - Number of API calls (future use)
  - `data_exports` (integer, default 0) - Number of data exports
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - UNIQUE constraint on (organization_id, period_start)

  ### `billing_history`
  Payment and billing history
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, nullable, fk -> organizations.id) - Organization (if org subscription)
  - `user_id` (uuid, nullable, fk -> users.id) - User (if personal subscription)
  - `subscription_id` (uuid, not null) - Reference to subscription
  - `amount` (numeric, not null) - Amount charged
  - `currency` (text, default 'JPY') - Currency code
  - `status` (text, not null) - Status: 'paid', 'pending', 'failed', 'refunded'
  - `billing_date` (timestamptz, not null) - Date of billing
  - `paid_date` (timestamptz, nullable) - Date payment was received
  - `invoice_url` (text, nullable) - URL to invoice PDF
  - `payment_method` (text, nullable) - Payment method used
  - `notes` (text, default '') - Additional notes
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - CHECK constraint: either organization_id or user_id must be set

  ### `permission_definitions`
  Define available permissions in the system
  - `id` (uuid, primary key) - Unique identifier
  - `permission_key` (text, unique, not null) - Permission identifier (e.g., 'athlete.create')
  - `name` (text, not null) - Human-readable name
  - `description` (text, default '') - Permission description
  - `category` (text, not null) - Category: 'athlete', 'training', 'reports', 'organization', 'billing'
  - `is_active` (boolean, default true) - Whether permission is active
  - `created_at` (timestamptz, default now()) - Creation timestamp

  ### `role_permissions`
  Map permissions to organization roles
  - `id` (uuid, primary key) - Unique identifier
  - `role` (text, not null) - Role name (matches organization_members.role)
  - `permission_id` (uuid, not null, fk -> permission_definitions.id) - Permission
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - UNIQUE constraint on (role, permission_id)

  ## Security

  ### RLS Policies

  All tables have RLS enabled with appropriate policies:
  - Admins can view and manage all subscription data
  - Organization admins can view their organization's subscription and billing
  - Users can view their own personal subscriptions
  - Usage tracking is visible to organization admins
  - Permission definitions are readable by authenticated users

  ## Indexes

  Performance indexes on foreign keys and frequently queried columns:
  - `idx_org_subscriptions_organization_id` on organization_subscriptions(organization_id)
  - `idx_org_subscriptions_status` on organization_subscriptions(status)
  - `idx_user_subscriptions_user_id` on user_subscriptions(user_id)
  - `idx_user_subscriptions_status` on user_subscriptions(status)
  - `idx_usage_tracking_organization_id` on usage_tracking(organization_id)
  - `idx_billing_history_organization_id` on billing_history(organization_id)
  - `idx_billing_history_user_id` on billing_history(user_id)
  - `idx_billing_history_status` on billing_history(status)
  - `idx_role_permissions_role` on role_permissions(role)

  ## Important Notes

  1. **Default Plans**: Free and paid plans should be created after migration
  2. **Trial Periods**: Organizations can have trial_end date for trial periods
  3. **Cascading**: Deleting an organization cascades to subscriptions and usage data
  4. **Billing**: Both organization and user subscriptions share billing_history table
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  price_monthly numeric NOT NULL,
  price_yearly numeric NOT NULL,
  athlete_limit integer DEFAULT NULL,
  storage_gb integer DEFAULT 10,
  features jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create organization_subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'trial', 'expired', 'cancelled')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  trial_end timestamptz DEFAULT NULL,
  cancel_at_period_end boolean DEFAULT false,
  billing_email text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'trial', 'expired', 'cancelled')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  trial_end timestamptz DEFAULT NULL,
  cancel_at_period_end boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  active_athletes integer DEFAULT 0,
  total_users integer DEFAULT 0,
  storage_used_mb numeric DEFAULT 0,
  api_calls integer DEFAULT 0,
  data_exports integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, period_start)
);

-- Create billing_history table
CREATE TABLE IF NOT EXISTS billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'JPY',
  status text NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  billing_date timestamptz NOT NULL,
  paid_date timestamptz,
  invoice_url text,
  payment_method text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CHECK ((organization_id IS NOT NULL AND user_id IS NULL) OR (organization_id IS NULL AND user_id IS NOT NULL))
);

-- Create permission_definitions table
CREATE TABLE IF NOT EXISTS permission_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL CHECK (category IN ('athlete', 'training', 'reports', 'organization', 'billing', 'admin')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid NOT NULL REFERENCES permission_definitions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Enable RLS on all new tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Authenticated users can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for organization_subscriptions
CREATE POLICY "Organization admins can view their organization subscription"
  ON organization_subscriptions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all organization subscriptions"
  ON organization_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can update their organization subscription"
  ON organization_subscriptions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'organization_admin'
    )
  );

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can update their own subscription"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user subscriptions"
  ON user_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for usage_tracking
CREATE POLICY "Organization admins can view their organization usage"
  ON usage_tracking FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all usage tracking"
  ON usage_tracking FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for billing_history
CREATE POLICY "Users can view their billing history"
  ON billing_history FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all billing history"
  ON billing_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for permission_definitions
CREATE POLICY "Authenticated users can view permission definitions"
  ON permission_definitions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage permission definitions"
  ON permission_definitions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for role_permissions
CREATE POLICY "Authenticated users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_organization_id ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_organization_id ON usage_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_organization_id ON billing_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, athlete_limit, storage_gb, features, sort_order) VALUES
  ('Free', '個人利用や小規模チーム向けの無料プラン', 0, 0, 5, 1, '{"advanced_analytics": false, "data_export": false, "priority_support": false, "custom_branding": false}'::jsonb, 1),
  ('Basic', '中規模チーム向けのベーシックプラン', 5000, 50000, 20, 10, '{"advanced_analytics": true, "data_export": true, "priority_support": false, "custom_branding": false}'::jsonb, 2),
  ('Pro', '大規模チーム向けのプロフェッショナルプラン', 15000, 150000, 100, 50, '{"advanced_analytics": true, "data_export": true, "priority_support": true, "custom_branding": true, "api_access": true}'::jsonb, 3),
  ('Enterprise', '組織全体向けのエンタープライズプラン', 50000, 500000, NULL, 500, '{"advanced_analytics": true, "data_export": true, "priority_support": true, "custom_branding": true, "api_access": true, "dedicated_support": true, "custom_integrations": true}'::jsonb, 4)
ON CONFLICT (name) DO NOTHING;

-- Insert default permission definitions
INSERT INTO permission_definitions (permission_key, name, description, category) VALUES
  ('athlete.view', 'アスリート閲覧', 'アスリートの情報を閲覧できる', 'athlete'),
  ('athlete.create', 'アスリート作成', '新しいアスリートを作成できる', 'athlete'),
  ('athlete.edit', 'アスリート編集', 'アスリートの情報を編集できる', 'athlete'),
  ('athlete.delete', 'アスリート削除', 'アスリートを削除できる', 'athlete'),
  ('training.view', 'トレーニング記録閲覧', 'トレーニング記録を閲覧できる', 'training'),
  ('training.create', 'トレーニング記録作成', '新しいトレーニング記録を作成できる', 'training'),
  ('training.edit', 'トレーニング記録編集', 'トレーニング記録を編集できる', 'training'),
  ('training.delete', 'トレーニング記録削除', 'トレーニング記録を削除できる', 'training'),
  ('reports.view', 'レポート閲覧', 'レポートとグラフを閲覧できる', 'reports'),
  ('reports.export', 'データエクスポート', 'データをエクスポートできる', 'reports'),
  ('organization.view', '組織情報閲覧', '組織の情報を閲覧できる', 'organization'),
  ('organization.edit', '組織情報編集', '組織の情報を編集できる', 'organization'),
  ('organization.members', 'メンバー管理', '組織メンバーを管理できる', 'organization'),
  ('billing.view', '課金情報閲覧', '課金とサブスクリプション情報を閲覧できる', 'billing'),
  ('billing.manage', '課金管理', 'サブスクリプションと支払いを管理できる', 'billing'),
  ('admin.full', '完全管理者権限', 'すべての操作を実行できる', 'admin')
ON CONFLICT (permission_key) DO NOTHING;

-- Insert default role-permission mappings
DO $$
DECLARE
  admin_perm_id uuid;
  org_admin_perms uuid[];
  dept_manager_perms uuid[];
  viewer_perms uuid[];
BEGIN
  -- Get all permission IDs for full admin
  SELECT id INTO admin_perm_id FROM permission_definitions WHERE permission_key = 'admin.full';

  -- Get permission IDs for organization_admin
  SELECT ARRAY_AGG(id) INTO org_admin_perms FROM permission_definitions
  WHERE permission_key IN (
    'athlete.view', 'athlete.create', 'athlete.edit', 'athlete.delete',
    'training.view', 'training.create', 'training.edit', 'training.delete',
    'reports.view', 'reports.export',
    'organization.view', 'organization.edit', 'organization.members',
    'billing.view', 'billing.manage'
  );

  -- Get permission IDs for department_manager
  SELECT ARRAY_AGG(id) INTO dept_manager_perms FROM permission_definitions
  WHERE permission_key IN (
    'athlete.view', 'athlete.create', 'athlete.edit',
    'training.view', 'training.create', 'training.edit',
    'reports.view', 'reports.export',
    'organization.view'
  );

  -- Get permission IDs for viewer
  SELECT ARRAY_AGG(id) INTO viewer_perms FROM permission_definitions
  WHERE permission_key IN (
    'athlete.view',
    'training.view',
    'reports.view',
    'organization.view'
  );

  -- Insert admin role permissions
  IF admin_perm_id IS NOT NULL THEN
    INSERT INTO role_permissions (role, permission_id) VALUES ('admin', admin_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert organization_admin role permissions
  IF org_admin_perms IS NOT NULL THEN
    INSERT INTO role_permissions (role, permission_id)
    SELECT 'organization_admin', unnest(org_admin_perms)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert department_manager role permissions
  IF dept_manager_perms IS NOT NULL THEN
    INSERT INTO role_permissions (role, permission_id)
    SELECT 'department_manager', unnest(dept_manager_perms)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert viewer role permissions
  IF viewer_perms IS NOT NULL THEN
    INSERT INTO role_permissions (role, permission_id)
    SELECT 'viewer', unnest(viewer_perms)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
