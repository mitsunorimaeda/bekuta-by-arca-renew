/*
  # Add Injury Risk Tracking and Team Analytics

  1. New Tables
    - `injury_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `organization_id` (uuid, foreign key to organizations)
      - `injury_type` (text) - muscle_strain, joint_pain, fracture, concussion, etc.
      - `body_part` (text) - ankle, knee, shoulder, hamstring, etc.
      - `severity` (text) - minor, moderate, severe
      - `occurred_date` (date)
      - `recovered_date` (date, nullable)
      - `days_out` (integer, nullable)
      - `cause` (text, nullable) - overtraining, accident, fatigue, etc.
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `injury_risk_assessments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `assessment_date` (date)
      - `risk_score` (decimal) - 0-100 scale
      - `acwr_based_risk` (decimal, nullable)
      - `workload_spike_risk` (decimal, nullable)
      - `fatigue_risk` (decimal, nullable)
      - `recent_injury_risk` (decimal, nullable)
      - `recommendations` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Athletes can view their own injury records
    - Coaches can view and manage injury records for their team members
    - Organization admins can view all injury data

  3. Indexes
    - Add indexes for efficient team-wide queries
*/

-- Create injury_records table
CREATE TABLE IF NOT EXISTS injury_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  injury_type text NOT NULL CHECK (injury_type IN (
    'muscle_strain', 'joint_pain', 'fracture', 'concussion', 
    'ligament_tear', 'tendon_injury', 'stress_fracture', 'other'
  )),
  body_part text NOT NULL CHECK (body_part IN (
    'ankle', 'knee', 'hip', 'hamstring', 'quadriceps', 'calf',
    'shoulder', 'elbow', 'wrist', 'back', 'neck', 'head', 'other'
  )),
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  occurred_date date NOT NULL,
  recovered_date date,
  days_out integer CHECK (days_out >= 0),
  cause text CHECK (cause IN ('overtraining', 'accident', 'fatigue', 'technique', 'equipment', 'other')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_recovery_date CHECK (recovered_date IS NULL OR recovered_date >= occurred_date)
);

-- Create injury_risk_assessments table
CREATE TABLE IF NOT EXISTS injury_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_date date NOT NULL,
  risk_score decimal(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  acwr_based_risk decimal(5,2) CHECK (acwr_based_risk >= 0 AND acwr_based_risk <= 100),
  workload_spike_risk decimal(5,2) CHECK (workload_spike_risk >= 0 AND workload_spike_risk <= 100),
  fatigue_risk decimal(5,2) CHECK (fatigue_risk >= 0 AND fatigue_risk <= 100),
  recent_injury_risk decimal(5,2) CHECK (recent_injury_risk >= 0 AND recent_injury_risk <= 100),
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, assessment_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_injury_records_user ON injury_records(user_id, occurred_date DESC);
CREATE INDEX IF NOT EXISTS idx_injury_records_org ON injury_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_injury_records_active ON injury_records(user_id, occurred_date) WHERE recovered_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_injury_risk_user ON injury_risk_assessments(user_id, assessment_date DESC);

-- Enable RLS
ALTER TABLE injury_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_risk_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for injury_records

-- Athletes can view their own injury records
CREATE POLICY "Athletes can view own injury records"
  ON injury_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Athletes can insert their own injury records
CREATE POLICY "Athletes can insert own injury records"
  ON injury_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Athletes can update their own injury records
CREATE POLICY "Athletes can update own injury records"
  ON injury_records FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Athletes can delete their own injury records
CREATE POLICY "Athletes can delete own injury records"
  ON injury_records FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Coaches can view injury records for athletes in their teams
CREATE POLICY "Coaches can view team injury records"
  ON injury_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = injury_records.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- Coaches can insert injury records for their team members
CREATE POLICY "Coaches can insert team injury records"
  ON injury_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = injury_records.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- Coaches can update injury records for their team members
CREATE POLICY "Coaches can update team injury records"
  ON injury_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = injury_records.user_id
        AND om.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = injury_records.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- Organization admins can view all injury records
CREATE POLICY "Org admins can view all injury records"
  ON injury_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = injury_records.organization_id
        AND organization_members.role = 'admin'
    )
  );

-- RLS Policies for injury_risk_assessments

-- Athletes can view their own risk assessments
CREATE POLICY "Athletes can view own risk assessments"
  ON injury_risk_assessments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Coaches can view risk assessments for their team members
CREATE POLICY "Coaches can view team risk assessments"
  ON injury_risk_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_member_assignments tma
      JOIN teams t ON t.id = tma.team_id
      JOIN organization_members om ON om.user_id = auth.uid() AND om.organization_id = t.organization_id
      WHERE tma.user_id = injury_risk_assessments.user_id
        AND om.role IN ('coach', 'admin')
    )
  );

-- System can insert risk assessments (for automated calculations)
CREATE POLICY "System can insert risk assessments"
  ON injury_risk_assessments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Triggers
CREATE OR REPLACE FUNCTION update_injury_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_injury_records_timestamp
  BEFORE UPDATE ON injury_records
  FOR EACH ROW
  EXECUTE FUNCTION update_injury_records_updated_at();

-- Function to calculate injury risk score
CREATE OR REPLACE FUNCTION calculate_injury_risk(p_user_id uuid, p_date date)
RETURNS decimal AS $$
DECLARE
  v_acwr_risk decimal := 0;
  v_workload_spike_risk decimal := 0;
  v_fatigue_risk decimal := 0;
  v_recent_injury_risk decimal := 0;
  v_total_risk decimal;
  v_recent_acwr decimal;
  v_recent_injury_count integer;
BEGIN
  -- Calculate ACWR-based risk
  SELECT 
    CASE 
      WHEN acwr > 1.5 THEN LEAST(((acwr - 1.5) / 0.5) * 40, 40)
      WHEN acwr < 0.8 THEN LEAST(((0.8 - acwr) / 0.2) * 30, 30)
      ELSE 0
    END INTO v_acwr_risk
  FROM (
    SELECT 
      COALESCE(SUM(CASE WHEN date >= p_date - 6 THEN load ELSE 0 END) / NULLIF(SUM(CASE WHEN date >= p_date - 27 AND date < p_date - 6 THEN load ELSE 0 END) / 3, 0), 0) as acwr
    FROM training_records
    WHERE user_id = p_user_id AND date <= p_date AND date >= p_date - 27
  ) acwr_calc;

  -- Calculate workload spike risk
  SELECT 
    CASE 
      WHEN weekly_increase > 0.3 THEN LEAST(weekly_increase * 60, 30)
      ELSE 0
    END INTO v_workload_spike_risk
  FROM (
    SELECT 
      COALESCE(
        (SUM(CASE WHEN date >= p_date - 6 THEN load ELSE 0 END) - 
         SUM(CASE WHEN date >= p_date - 13 AND date < p_date - 6 THEN load ELSE 0 END)) /
        NULLIF(SUM(CASE WHEN date >= p_date - 13 AND date < p_date - 6 THEN load ELSE 0 END), 0),
        0
      ) as weekly_increase
    FROM training_records
    WHERE user_id = p_user_id AND date <= p_date AND date >= p_date - 13
  ) spike_calc;

  -- Calculate recent injury risk
  SELECT COUNT(*) INTO v_recent_injury_count
  FROM injury_records
  WHERE user_id = p_user_id 
    AND occurred_date >= p_date - 90
    AND (recovered_date IS NULL OR recovered_date >= p_date - 30);

  v_recent_injury_risk := LEAST(v_recent_injury_count * 15, 30);

  -- Calculate total risk (weighted average)
  v_total_risk := (v_acwr_risk * 0.4) + (v_workload_spike_risk * 0.3) + (v_recent_injury_risk * 0.3);

  RETURN LEAST(v_total_risk, 100);
END;
$$ LANGUAGE plpgsql;
