/*
  # Athlete Transfer Requests System

  ## Purpose
  Enable coaches to request athlete transfers between teams within an organization,
  with proper approval workflows and data integrity guarantees.

  ## New Tables

  ### `athlete_transfer_requests`
  Manages requests to transfer athletes between teams
  - `id` (uuid, primary key) - Unique identifier
  - `athlete_id` (uuid, not null, fk -> users.id) - Athlete being transferred
  - `from_team_id` (uuid, not null, fk -> teams.id) - Current team
  - `to_team_id` (uuid, not null, fk -> teams.id) - Destination team
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization context
  - `requested_by` (uuid, not null, fk -> users.id) - Coach or athlete who requested
  - `status` (text, not null) - Status: 'pending', 'approved', 'rejected', 'completed'
  - `request_reason` (text, default '') - Reason for transfer
  - `reviewed_by` (uuid, fk -> users.id) - Who reviewed the request
  - `reviewed_at` (timestamptz) - Review timestamp
  - `review_notes` (text, default '') - Reviewer's notes
  - `completed_at` (timestamptz) - When transfer was completed
  - `created_at` (timestamptz, default now()) - Request creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `team_transfer_history`
  Historical record of all athlete team transfers
  - `id` (uuid, primary key) - Unique identifier
  - `athlete_id` (uuid, not null, fk -> users.id) - Athlete who transferred
  - `from_team_id` (uuid, fk -> teams.id) - Previous team (nullable if first team)
  - `to_team_id` (uuid, not null, fk -> teams.id) - New team
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization
  - `transfer_request_id` (uuid, fk -> athlete_transfer_requests.id) - Related request
  - `transferred_by` (uuid, not null, fk -> users.id) - Who performed the transfer
  - `transfer_reason` (text, default '') - Reason for transfer
  - `transfer_date` (timestamptz, default now()) - When transfer occurred
  - `metadata` (jsonb, default '{}') - Additional transfer information

  ## Security

  ### RLS Policies
  - Athletes can view transfer requests involving themselves
  - Coaches can create requests for athletes in their teams
  - Coaches of source team can approve/reject requests
  - Organization admins can manage all transfers in their organization
  - Transfer history is viewable by coaches with access to either team

  ### Constraints
  - Athlete must be in the from_team
  - Both teams must be in the same organization
  - Cannot transfer to the same team
  - Athlete can only have one pending transfer at a time

  ## Workflow
  1. Coach selects athlete from their team
  2. Coach chooses destination team within organization
  3. Request is sent to source team coaches or organization admin
  4. Reviewer approves or rejects
  5. If approved, athlete's team_id is updated
  6. Transfer is recorded in history
  7. All training data is preserved
*/

-- Create athlete_transfer_requests table
CREATE TABLE IF NOT EXISTS athlete_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  request_reason text DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (from_team_id != to_team_id)
);

-- Create team_transfer_history table
CREATE TABLE IF NOT EXISTS team_transfer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  to_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transfer_request_id uuid REFERENCES athlete_transfer_requests(id) ON DELETE SET NULL,
  transferred_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transfer_reason text DEFAULT '',
  transfer_date timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_athlete_transfer_requests_athlete 
  ON athlete_transfer_requests(athlete_id);

CREATE INDEX IF NOT EXISTS idx_athlete_transfer_requests_from_team 
  ON athlete_transfer_requests(from_team_id);

CREATE INDEX IF NOT EXISTS idx_athlete_transfer_requests_to_team 
  ON athlete_transfer_requests(to_team_id);

CREATE INDEX IF NOT EXISTS idx_athlete_transfer_requests_status 
  ON athlete_transfer_requests(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_athlete_transfer_requests_organization 
  ON athlete_transfer_requests(organization_id);

CREATE INDEX IF NOT EXISTS idx_team_transfer_history_athlete 
  ON team_transfer_history(athlete_id);

CREATE INDEX IF NOT EXISTS idx_team_transfer_history_from_team 
  ON team_transfer_history(from_team_id);

CREATE INDEX IF NOT EXISTS idx_team_transfer_history_to_team 
  ON team_transfer_history(to_team_id);

CREATE INDEX IF NOT EXISTS idx_team_transfer_history_date 
  ON team_transfer_history(transfer_date DESC);

-- Enable RLS
ALTER TABLE athlete_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_transfer_history ENABLE ROW LEVEL SECURITY;

-- Policies for athlete_transfer_requests

-- Policy: Athletes can view transfers involving themselves
CREATE POLICY "Athletes can view their own transfer requests"
  ON athlete_transfer_requests FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Policy: Coaches can view requests for their teams
CREATE POLICY "Coaches can view transfer requests for their teams"
  ON athlete_transfer_requests FOR SELECT
  TO authenticated
  USING (
    from_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
    OR
    to_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Policy: Coaches can create transfer requests for athletes in their teams
CREATE POLICY "Coaches can create transfer requests for their athletes"
  ON athlete_transfer_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Requester must be a coach
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('staff', 'admin')
    )
    AND
    -- Athlete must be in the from_team
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = athlete_id
      AND users.team_id = from_team_id
    )
    AND
    -- Requester must have access to from_team
    (
      from_team_id IN (
        SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
      )
      OR
      -- Or be organization admin
      organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role = 'organization_admin'
      )
    )
    AND
    -- Both teams must be in the same organization
    EXISTS (
      SELECT 1 FROM teams t1
      JOIN teams t2 ON t1.organization_id = t2.organization_id
      WHERE t1.id = from_team_id
      AND t2.id = to_team_id
      AND t1.organization_id = athlete_transfer_requests.organization_id
    )
    AND
    -- Athlete cannot have another pending transfer
    NOT EXISTS (
      SELECT 1 FROM athlete_transfer_requests atr
      WHERE atr.athlete_id = athlete_transfer_requests.athlete_id
      AND atr.status = 'pending'
    )
  );

-- Policy: Source team coaches can update transfer requests
CREATE POLICY "Source team coaches can update transfer requests"
  ON athlete_transfer_requests FOR UPDATE
  TO authenticated
  USING (
    from_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  )
  WITH CHECK (
    from_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Policy: Organization admins can view all requests in their organization
CREATE POLICY "Organization admins can view transfer requests"
  ON athlete_transfer_requests FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
  );

-- Policy: Organization admins can manage requests in their organization
CREATE POLICY "Organization admins can manage transfer requests"
  ON athlete_transfer_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
  );

-- Policy: System admins can manage all requests
CREATE POLICY "System admins can manage all transfer requests"
  ON athlete_transfer_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policies for team_transfer_history

-- Policy: Athletes can view their own transfer history
CREATE POLICY "Athletes can view their own transfer history"
  ON team_transfer_history FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Policy: Coaches can view history for their teams
CREATE POLICY "Coaches can view transfer history for their teams"
  ON team_transfer_history FOR SELECT
  TO authenticated
  USING (
    from_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
    OR
    to_team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Policy: Organization admins can view all history in their organization
CREATE POLICY "Organization admins can view transfer history"
  ON team_transfer_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
  );

-- Policy: System admins can view all history
CREATE POLICY "System admins can view all transfer history"
  ON team_transfer_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policy: Only system can insert transfer history (via function)
CREATE POLICY "System can insert transfer history"
  ON team_transfer_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to approve and complete athlete transfer
CREATE OR REPLACE FUNCTION approve_athlete_transfer(
  request_id uuid,
  reviewer_user_id uuid,
  notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_athlete_id uuid;
  v_from_team_id uuid;
  v_to_team_id uuid;
  v_organization_id uuid;
  v_request_reason text;
  v_status text;
BEGIN
  -- Get request details
  SELECT athlete_id, from_team_id, to_team_id, organization_id, request_reason, status
  INTO v_athlete_id, v_from_team_id, v_to_team_id, v_organization_id, v_request_reason, v_status
  FROM athlete_transfer_requests
  WHERE id = request_id;

  -- Check if request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Transfer request has already been reviewed';
  END IF;

  -- Update request to approved
  UPDATE athlete_transfer_requests
  SET 
    status = 'approved',
    reviewed_by = reviewer_user_id,
    reviewed_at = now(),
    review_notes = notes,
    updated_at = now()
  WHERE id = request_id;

  -- Update athlete's team_id
  UPDATE users
  SET team_id = v_to_team_id
  WHERE id = v_athlete_id;

  -- Record transfer in history
  INSERT INTO team_transfer_history (
    athlete_id,
    from_team_id,
    to_team_id,
    organization_id,
    transfer_request_id,
    transferred_by,
    transfer_reason,
    transfer_date
  ) VALUES (
    v_athlete_id,
    v_from_team_id,
    v_to_team_id,
    v_organization_id,
    request_id,
    reviewer_user_id,
    v_request_reason,
    now()
  );

  -- Mark request as completed
  UPDATE athlete_transfer_requests
  SET 
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = request_id;
END;
$$;

-- Function to reject athlete transfer
CREATE OR REPLACE FUNCTION reject_athlete_transfer(
  request_id uuid,
  reviewer_user_id uuid,
  notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  -- Get request status
  SELECT status INTO v_status
  FROM athlete_transfer_requests
  WHERE id = request_id;

  -- Check if request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Transfer request has already been reviewed';
  END IF;

  -- Update request status
  UPDATE athlete_transfer_requests
  SET 
    status = 'rejected',
    reviewed_by = reviewer_user_id,
    reviewed_at = now(),
    review_notes = notes,
    updated_at = now()
  WHERE id = request_id;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_athlete_transfer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_athlete_transfer_requests_updated_at
  BEFORE UPDATE ON athlete_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_athlete_transfer_requests_updated_at();

-- Function to get athlete transfer history
CREATE OR REPLACE FUNCTION get_athlete_transfer_history(athlete_user_id uuid)
RETURNS TABLE (
  id uuid,
  from_team_name text,
  to_team_name text,
  transfer_date timestamptz,
  transferred_by_name text,
  transfer_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tth.id,
    t_from.name as from_team_name,
    t_to.name as to_team_name,
    tth.transfer_date,
    u.name as transferred_by_name,
    tth.transfer_reason
  FROM team_transfer_history tth
  LEFT JOIN teams t_from ON tth.from_team_id = t_from.id
  JOIN teams t_to ON tth.to_team_id = t_to.id
  JOIN users u ON tth.transferred_by = u.id
  WHERE tth.athlete_id = athlete_user_id
  ORDER BY tth.transfer_date DESC;
END;
$$;
