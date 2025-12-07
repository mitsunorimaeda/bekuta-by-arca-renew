/*
  # Add Advanced Report System

  1. New Tables
    - `report_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text) - Template name
      - `description` (text)
      - `report_type` (text) - individual, team, organization
      - `sections` (jsonb) - Array of section configurations
      - `metrics` (jsonb) - Array of metrics to include
      - `filters` (jsonb) - Default filters
      - `is_default` (boolean)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scheduled_reports`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `template_id` (uuid, foreign key to report_templates)
      - `name` (text)
      - `schedule_type` (text) - daily, weekly, monthly
      - `schedule_config` (jsonb) - Day of week, time, etc.
      - `recipients` (jsonb) - Array of email addresses
      - `filters` (jsonb)
      - `is_active` (boolean)
      - `last_run` (timestamptz)
      - `next_run` (timestamptz)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `report_history`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `template_id` (uuid, foreign key to report_templates)
      - `scheduled_report_id` (uuid, nullable, foreign key to scheduled_reports)
      - `report_type` (text)
      - `generated_by` (uuid, foreign key to users)
      - `parameters` (jsonb) - Report parameters used
      - `file_path` (text, nullable) - Path to generated file
      - `status` (text) - pending, completed, failed
      - `error_message` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Organization admins and coaches can manage templates and schedules
    - Users can view reports for their organization

  3. Indexes
    - Add indexes for efficient querying
*/

-- Create report_templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  report_type text NOT NULL CHECK (report_type IN ('individual', 'team', 'organization')),
  sections jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_run timestamptz,
  next_run timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  scheduled_report_id uuid REFERENCES scheduled_reports(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  generated_by uuid NOT NULL REFERENCES users(id),
  parameters jsonb DEFAULT '{}'::jsonb,
  file_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_history_org ON report_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_user ON report_history(generated_by, created_at DESC);

-- Enable RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_templates

-- Org members can view templates
CREATE POLICY "Org members can view report templates"
  ON report_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_templates.organization_id
    )
  );

-- Coaches and admins can create templates
CREATE POLICY "Coaches and admins can create report templates"
  ON report_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_templates.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- Coaches and admins can update templates
CREATE POLICY "Coaches and admins can update report templates"
  ON report_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_templates.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_templates.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- Coaches and admins can delete templates
CREATE POLICY "Coaches and admins can delete report templates"
  ON report_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_templates.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- RLS Policies for scheduled_reports

-- Org members can view scheduled reports
CREATE POLICY "Org members can view scheduled reports"
  ON scheduled_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = scheduled_reports.organization_id
    )
  );

-- Coaches and admins can create scheduled reports
CREATE POLICY "Coaches and admins can create scheduled reports"
  ON scheduled_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = scheduled_reports.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- Coaches and admins can update scheduled reports
CREATE POLICY "Coaches and admins can update scheduled reports"
  ON scheduled_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = scheduled_reports.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = scheduled_reports.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- Coaches and admins can delete scheduled reports
CREATE POLICY "Coaches and admins can delete scheduled reports"
  ON scheduled_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = scheduled_reports.organization_id
        AND organization_members.role IN ('coach', 'admin')
    )
  );

-- RLS Policies for report_history

-- Org members can view report history
CREATE POLICY "Org members can view report history"
  ON report_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_history.organization_id
    )
  );

-- Users can create report history entries
CREATE POLICY "Users can create report history entries"
  ON report_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = report_history.organization_id
    )
  );

-- Triggers
CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_templates_timestamp
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_report_templates_updated_at();

CREATE TRIGGER update_scheduled_reports_timestamp
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_reports_updated_at();

-- Function to calculate next run time for scheduled reports
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_schedule_type text,
  p_schedule_config jsonb,
  p_from_date timestamptz DEFAULT now()
)
RETURNS timestamptz AS $$
DECLARE
  v_next_run timestamptz;
  v_day_of_week integer;
  v_day_of_month integer;
  v_time time;
BEGIN
  v_time := COALESCE((p_schedule_config->>'time')::time, '09:00:00'::time);

  CASE p_schedule_type
    WHEN 'daily' THEN
      v_next_run := (p_from_date::date + interval '1 day' + v_time::interval)::timestamptz;
    
    WHEN 'weekly' THEN
      v_day_of_week := COALESCE((p_schedule_config->>'day_of_week')::integer, 1);
      v_next_run := (p_from_date::date + ((7 + v_day_of_week - EXTRACT(DOW FROM p_from_date)::integer) % 7)::integer * interval '1 day' + v_time::interval)::timestamptz;
      IF v_next_run <= p_from_date THEN
        v_next_run := v_next_run + interval '7 days';
      END IF;
    
    WHEN 'monthly' THEN
      v_day_of_month := COALESCE((p_schedule_config->>'day_of_month')::integer, 1);
      v_next_run := (date_trunc('month', p_from_date) + (v_day_of_month - 1)::integer * interval '1 day' + v_time::interval)::timestamptz;
      IF v_next_run <= p_from_date THEN
        v_next_run := (date_trunc('month', p_from_date + interval '1 month') + (v_day_of_month - 1)::integer * interval '1 day' + v_time::interval)::timestamptz;
      END IF;
    
    ELSE
      v_next_run := NULL;
  END CASE;

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;
