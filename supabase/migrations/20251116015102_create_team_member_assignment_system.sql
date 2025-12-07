/*
  # Create Team Member Assignment System

  ## Overview
  Creates a comprehensive system for managing team member assignments within organizations.
  This allows organization administrators to assign users to teams and track assignment history.

  ## New Tables

  ### 1. team_member_assignments
  Tracks current team assignments for all users (athletes and staff).
  - `id` (uuid, primary key)
  - `user_id` (uuid, references users) - The user being assigned
  - `team_id` (uuid, references teams) - The team they're assigned to
  - `organization_id` (uuid, references organizations) - The parent organization
  - `assigned_by` (uuid, references users) - Who made the assignment
  - `assigned_at` (timestamptz) - When the assignment was made
  - `assignment_type` (text) - 'primary' or 'secondary' (for staff with multiple teams)
  - `notes` (text, nullable) - Optional notes about the assignment

  ### 2. team_assignment_history
  Tracks the history of all team assignments for auditing.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references users) - The user
  - `from_team_id` (uuid, nullable, references teams) - Previous team
  - `to_team_id` (uuid, references teams) - New team
  - `organization_id` (uuid, references organizations) - The organization
  - `assigned_by` (uuid, references users) - Who made the change
  - `assignment_reason` (text, nullable) - Reason for the assignment
  - `changed_at` (timestamptz) - When the change occurred
  - `change_type` (text) - 'assigned', 'transferred', or 'removed'

  ## Security
  - Enable RLS on both tables
  - Organization admins can manage assignments in their organization
  - System admins can manage all assignments
  - Users can view their own assignment history

  ## Indexes
  - Add indexes on frequently queried columns for performance
*/

-- ============================================================================
-- Create team_member_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_member_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assignment_type text NOT NULL CHECK (assignment_type IN ('primary', 'secondary')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure each user has only one primary assignment per organization
  UNIQUE(user_id, organization_id, assignment_type, team_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_member_assignments_user_id 
  ON team_member_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_team_member_assignments_team_id 
  ON team_member_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_team_member_assignments_organization_id 
  ON team_member_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_member_assignments_type 
  ON team_member_assignments(assignment_type);

-- ============================================================================
-- Create team_assignment_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  to_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assignment_reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL CHECK (change_type IN ('assigned', 'transferred', 'removed')),
  
  -- At least one of from_team_id or to_team_id must be set
  CONSTRAINT check_team_ids CHECK (from_team_id IS NOT NULL OR to_team_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_assignment_history_user_id 
  ON team_assignment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_assignment_history_organization_id 
  ON team_assignment_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_assignment_history_changed_at 
  ON team_assignment_history(changed_at DESC);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE team_member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_assignment_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for team_member_assignments
-- ============================================================================

-- Organization admins can view assignments in their organization
CREATE POLICY "Organization admins can view team assignments in their org"
  ON team_member_assignments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Users can view their own assignments
CREATE POLICY "Users can view their own team assignments"
  ON team_member_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can view assignments for their teams
CREATE POLICY "Staff can view assignments for their teams"
  ON team_member_assignments FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Organization admins can insert assignments in their organization
CREATE POLICY "Organization admins can create team assignments"
  ON team_member_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Organization admins can update assignments in their organization
CREATE POLICY "Organization admins can update team assignments"
  ON team_member_assignments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Organization admins can delete assignments in their organization
CREATE POLICY "Organization admins can delete team assignments"
  ON team_member_assignments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ============================================================================
-- RLS Policies for team_assignment_history
-- ============================================================================

-- Organization admins can view history in their organization
CREATE POLICY "Organization admins can view team assignment history"
  ON team_assignment_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Users can view their own assignment history
CREATE POLICY "Users can view their own team assignment history"
  ON team_assignment_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system can insert history records (through triggers)
CREATE POLICY "System can insert team assignment history"
  ON team_assignment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to assign a user to a team
CREATE OR REPLACE FUNCTION assign_user_to_team(
  p_user_id uuid,
  p_team_id uuid,
  p_organization_id uuid,
  p_assignment_type text DEFAULT 'primary',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
  v_previous_team_id uuid;
BEGIN
  -- Check if user already has an assignment of this type
  SELECT team_id INTO v_previous_team_id
  FROM team_member_assignments
  WHERE user_id = p_user_id 
    AND organization_id = p_organization_id
    AND assignment_type = p_assignment_type
  LIMIT 1;

  -- If changing teams, record the change in history
  IF v_previous_team_id IS NOT NULL AND v_previous_team_id != p_team_id THEN
    INSERT INTO team_assignment_history (
      user_id,
      from_team_id,
      to_team_id,
      organization_id,
      assigned_by,
      change_type
    ) VALUES (
      p_user_id,
      v_previous_team_id,
      p_team_id,
      p_organization_id,
      auth.uid(),
      'transferred'
    );

    -- Update existing assignment
    UPDATE team_member_assignments
    SET team_id = p_team_id,
        assigned_by = auth.uid(),
        assigned_at = now(),
        notes = p_notes,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND organization_id = p_organization_id
      AND assignment_type = p_assignment_type
    RETURNING id INTO v_assignment_id;
  ELSE
    -- Create new assignment
    INSERT INTO team_member_assignments (
      user_id,
      team_id,
      organization_id,
      assigned_by,
      assignment_type,
      notes
    ) VALUES (
      p_user_id,
      p_team_id,
      p_organization_id,
      auth.uid(),
      p_assignment_type,
      p_notes
    )
    ON CONFLICT (user_id, organization_id, assignment_type, team_id) 
    DO UPDATE SET
      assigned_by = auth.uid(),
      assigned_at = now(),
      notes = p_notes,
      updated_at = now()
    RETURNING id INTO v_assignment_id;

    -- Record in history if this is a new assignment
    IF v_previous_team_id IS NULL THEN
      INSERT INTO team_assignment_history (
        user_id,
        to_team_id,
        organization_id,
        assigned_by,
        change_type
      ) VALUES (
        p_user_id,
        p_team_id,
        p_organization_id,
        auth.uid(),
        'assigned'
      );
    END IF;
  END IF;

  RETURN v_assignment_id;
END;
$$;

-- Function to remove a user from a team
CREATE OR REPLACE FUNCTION remove_user_from_team(
  p_user_id uuid,
  p_team_id uuid,
  p_organization_id uuid,
  p_assignment_type text DEFAULT 'primary'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Record in history
  INSERT INTO team_assignment_history (
    user_id,
    from_team_id,
    organization_id,
    assigned_by,
    change_type
  ) VALUES (
    p_user_id,
    p_team_id,
    p_organization_id,
    auth.uid(),
    'removed'
  );

  -- Delete the assignment
  DELETE FROM team_member_assignments
  WHERE user_id = p_user_id 
    AND team_id = p_team_id
    AND organization_id = p_organization_id
    AND assignment_type = p_assignment_type;

  RETURN true;
END;
$$;

-- Function to get team members with assignment info
CREATE OR REPLACE FUNCTION get_team_members_with_assignments(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role text,
  assignment_type text,
  assigned_at timestamptz,
  assigned_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    tma.assignment_type,
    tma.assigned_at,
    assigner.name as assigned_by_name
  FROM users u
  INNER JOIN team_member_assignments tma ON u.id = tma.user_id
  LEFT JOIN users assigner ON tma.assigned_by = assigner.id
  WHERE tma.team_id = p_team_id
  ORDER BY tma.assignment_type, u.name;
END;
$$;

-- Function to get unassigned organization members
CREATE OR REPLACE FUNCTION get_unassigned_organization_members(p_organization_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.role
  FROM users u
  INNER JOIN organization_members om ON u.id = om.user_id
  WHERE om.organization_id = p_organization_id
    AND NOT EXISTS (
      SELECT 1 FROM team_member_assignments tma
      WHERE tma.user_id = u.id 
        AND tma.organization_id = p_organization_id
        AND tma.assignment_type = 'primary'
    )
  ORDER BY u.name;
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_team_member_assignment_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_team_member_assignment_timestamp ON team_member_assignments;
CREATE TRIGGER trigger_update_team_member_assignment_timestamp
  BEFORE UPDATE ON team_member_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_team_member_assignment_timestamp();

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Team member assignment system created successfully!';
  RAISE NOTICE 'Tables: team_member_assignments, team_assignment_history';
  RAISE NOTICE 'Functions: assign_user_to_team, remove_user_from_team, get_team_members_with_assignments, get_unassigned_organization_members';
END $$;
