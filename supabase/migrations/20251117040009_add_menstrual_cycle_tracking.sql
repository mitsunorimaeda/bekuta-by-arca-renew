/*
  # Add Menstrual Cycle and Basal Body Temperature Tracking

  1. New Tables
    - `menstrual_cycles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `organization_id` (uuid, foreign key to organizations)
      - `cycle_start_date` (date) - First day of period
      - `cycle_end_date` (date, nullable) - Last day before next period starts
      - `period_duration_days` (integer, nullable) - Length of menstruation
      - `cycle_length_days` (integer, nullable) - Total cycle length
      - `flow_intensity` (text, nullable) - light, moderate, heavy
      - `symptoms` (jsonb, nullable) - Array of symptoms (cramps, mood_changes, fatigue, etc.)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `basal_body_temperature`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `organization_id` (uuid, foreign key to organizations)
      - `measurement_date` (date)
      - `temperature_celsius` (decimal) - Basal body temperature
      - `measurement_time` (time, nullable) - Time of measurement
      - `sleep_quality` (integer, nullable) - 1-5 scale
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Athletes can manage their own cycle and temperature data
    - Coaches can view data for athletes in their teams
    - Organization admins can view all data in their organization

  3. Indexes
    - Add indexes for efficient querying by user and date ranges
*/

-- Create menstrual_cycles table
CREATE TABLE IF NOT EXISTS menstrual_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_start_date date NOT NULL,
  cycle_end_date date,
  period_duration_days integer CHECK (period_duration_days > 0 AND period_duration_days <= 14),
  cycle_length_days integer CHECK (cycle_length_days > 0 AND cycle_length_days <= 60),
  flow_intensity text CHECK (flow_intensity IN ('light', 'moderate', 'heavy')),
  symptoms jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_cycle_dates CHECK (cycle_end_date IS NULL OR cycle_end_date >= cycle_start_date)
);

-- Create basal_body_temperature table
CREATE TABLE IF NOT EXISTS basal_body_temperature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  measurement_date date NOT NULL,
  temperature_celsius decimal(4,2) NOT NULL CHECK (temperature_celsius >= 35.0 AND temperature_celsius <= 42.0),
  measurement_time time,
  sleep_quality integer CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, measurement_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_user_date ON menstrual_cycles(user_id, cycle_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_org ON menstrual_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_bbt_user_date ON basal_body_temperature(user_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_bbt_org ON basal_body_temperature(organization_id);

-- Enable RLS
ALTER TABLE menstrual_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE basal_body_temperature ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menstrual_cycles

-- Athletes can view their own cycle data
CREATE POLICY "Athletes can view own menstrual cycles"
  ON menstrual_cycles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Athletes can insert their own cycle data
CREATE POLICY "Athletes can insert own menstrual cycles"
  ON menstrual_cycles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Athletes can update their own cycle data
CREATE POLICY "Athletes can update own menstrual cycles"
  ON menstrual_cycles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Athletes can delete their own cycle data
CREATE POLICY "Athletes can delete own menstrual cycles"
  ON menstrual_cycles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Coaches can view cycle data for athletes in their teams
CREATE POLICY "Coaches can view team menstrual cycles"
  ON menstrual_cycles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = menstrual_cycles.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- Organization admins can view all cycle data in their organization
CREATE POLICY "Org admins can view all menstrual cycles"
  ON menstrual_cycles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = menstrual_cycles.organization_id
        AND organization_members.role = 'admin'
    )
  );

-- RLS Policies for basal_body_temperature

-- Athletes can view their own temperature data
CREATE POLICY "Athletes can view own basal body temperature"
  ON basal_body_temperature FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Athletes can insert their own temperature data
CREATE POLICY "Athletes can insert own basal body temperature"
  ON basal_body_temperature FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Athletes can update their own temperature data
CREATE POLICY "Athletes can update own basal body temperature"
  ON basal_body_temperature FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Athletes can delete their own temperature data
CREATE POLICY "Athletes can delete own basal body temperature"
  ON basal_body_temperature FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Coaches can view temperature data for athletes in their teams
CREATE POLICY "Coaches can view team basal body temperature"
  ON basal_body_temperature FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = basal_body_temperature.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- Organization admins can view all temperature data in their organization
CREATE POLICY "Org admins can view all basal body temperature"
  ON basal_body_temperature FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = basal_body_temperature.organization_id
        AND organization_members.role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_menstrual_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_bbt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_menstrual_cycles_timestamp
  BEFORE UPDATE ON menstrual_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_menstrual_cycles_updated_at();

CREATE TRIGGER update_bbt_timestamp
  BEFORE UPDATE ON basal_body_temperature
  FOR EACH ROW
  EXECUTE FUNCTION update_bbt_updated_at();
