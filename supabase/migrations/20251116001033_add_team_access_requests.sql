/*
  # Team Access Requests System

  ## Purpose
  Enable coaches to request access to additional teams within their organization,
  reducing administrative burden while maintaining security.

  ## New Tables

  ### `team_access_requests`
  Manages coach requests to access additional teams in the organization
  - `id` (uuid, primary key) - Unique identifier
  - `requester_id` (uuid, not null, fk -> users.id) - Coach requesting access
  - `team_id` (uuid, not null, fk -> teams.id) - Team being requested
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization context
  - `status` (text, not null) - Request status: 'pending', 'approved', 'rejected'
  - `request_message` (text, default '') - Optional message from requester
  - `reviewed_by` (uuid, fk -> users.id) - Admin/coach who reviewed the request
  - `reviewed_at` (timestamptz) - Timestamp of review
  - `review_notes` (text, default '') - Optional notes from reviewer
  - `created_at` (timestamptz, default now()) - Request creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp
  - UNIQUE constraint on (requester_id, team_id) - Prevent duplicate requests

  ## Security

  ### RLS Policies
  - Coaches can view their own requests
  - Coaches can create requests for teams in their organization
  - Coaches with access to the requested team can review requests
  - Organization admins can view and manage all requests in their organization
  - System admins can view and manage all requests

  ### Constraints
  - Requester must be a staff member
  - Team must belong to an organization
  - Requester must be in the same organization as the team
  - Status can only be 'pending', 'approved', or 'rejected'

  ## Workflow
  1. Coach views available teams in their organization
  2. Coach submits request to access a team
  3. Request is sent to existing coaches of that team or organization admin
  4. Reviewer approves or rejects the request
  5. If approved, staff_team_links entry is automatically created
  6. Coach immediately gains access to the team's data
*/

-- Create team_access_requests table
CREATE TABLE IF NOT EXISTS team_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  request_message text DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, team_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_team_access_requests_status 
  ON team_access_requests(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_access_requests_requester 
  ON team_access_requests(requester_id);

CREATE INDEX IF NOT EXISTS idx_team_access_requests_team 
  ON team_access_requests(team_id);

CREATE INDEX IF NOT EXISTS idx_team_access_requests_organization 
  ON team_access_requests(organization_id);

-- Enable RLS
ALTER TABLE team_access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches can view their own requests
CREATE POLICY "Coaches can view their own requests"
  ON team_access_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid());

-- Policy: Coaches can create requests for teams in their organization
CREATE POLICY "Coaches can create requests in their organization"
  ON team_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Requester must be a staff member
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('staff', 'admin')
    )
    AND
    -- Requester must be in the same organization
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = team_access_requests.organization_id
    )
    AND
    -- Team must belong to the organization
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_access_requests.team_id
      AND teams.organization_id = team_access_requests.organization_id
    )
    AND
    -- Cannot request access to a team they already have access to
    NOT EXISTS (
      SELECT 1 FROM staff_team_links
      WHERE staff_user_id = auth.uid()
      AND team_id = team_access_requests.team_id
    )
  );

-- Policy: Coaches with access to the team can view and review requests
CREATE POLICY "Team coaches can review requests for their team"
  ON team_access_requests FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Policy: Team coaches can update requests for their team
CREATE POLICY "Team coaches can update requests for their team"
  ON team_access_requests FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Policy: Organization admins can view all requests in their organization
CREATE POLICY "Organization admins can view requests in their organization"
  ON team_access_requests FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('organization_admin')
    )
  );

-- Policy: Organization admins can manage requests in their organization
CREATE POLICY "Organization admins can manage requests in their organization"
  ON team_access_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('organization_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('organization_admin')
    )
  );

-- Policy: System admins can view all requests
CREATE POLICY "System admins can view all requests"
  ON team_access_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Policy: System admins can manage all requests
CREATE POLICY "System admins can manage all requests"
  ON team_access_requests FOR ALL
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

-- Function to approve team access request
CREATE OR REPLACE FUNCTION approve_team_access_request(
  request_id uuid,
  reviewer_user_id uuid,
  notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requester_id uuid;
  v_team_id uuid;
  v_status text;
BEGIN
  -- Get request details
  SELECT requester_id, team_id, status
  INTO v_requester_id, v_team_id, v_status
  FROM team_access_requests
  WHERE id = request_id;

  -- Check if request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Request has already been reviewed';
  END IF;

  -- Update request status
  UPDATE team_access_requests
  SET 
    status = 'approved',
    reviewed_by = reviewer_user_id,
    reviewed_at = now(),
    review_notes = notes,
    updated_at = now()
  WHERE id = request_id;

  -- Add staff_team_links entry
  INSERT INTO staff_team_links (staff_user_id, team_id)
  VALUES (v_requester_id, v_team_id)
  ON CONFLICT (staff_user_id, team_id) DO NOTHING;
END;
$$;

-- Function to reject team access request
CREATE OR REPLACE FUNCTION reject_team_access_request(
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
  FROM team_access_requests
  WHERE id = request_id;

  -- Check if request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Request has already been reviewed';
  END IF;

  -- Update request status
  UPDATE team_access_requests
  SET 
    status = 'rejected',
    reviewed_by = reviewer_user_id,
    reviewed_at = reviewed_at,
    review_notes = notes,
    updated_at = now()
  WHERE id = request_id;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_team_access_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_access_requests_updated_at
  BEFORE UPDATE ON team_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_team_access_requests_updated_at();
