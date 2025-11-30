/*
  # Remove Departments and Consolidate to Teams

  ## Purpose
  Simplify the organization structure by removing the department layer and
  consolidating functionality directly into teams. Organizations will now
  directly contain teams, creating a simpler 2-tier hierarchy.

  ## Changes Overview

  ### Tables
  1. **teams** - Enhanced to be organization's primary organizational unit
     - Add `description` (text) - Team description
     - Add `settings` (jsonb) - Flexible settings storage
     - Remove `department_id` - No longer needed
     - Keep `organization_id` - Direct link to organization

  2. **departments** - DELETED
     - All data will be removed
     - All foreign key references will be cleaned up

  3. **department_managers** - DELETED
     - No longer needed (coaches use staff_team_links)

  4. **organization_members** - Updated
     - Role 'department_manager' removed from CHECK constraint
     - Only 'organization_admin' and 'viewer' remain

  ### Functions
  - DROP `safe_delete_department()` - No longer needed
  - DROP `validate_team_org_dept_consistency()` - No longer needed
  - UPDATE `get_organization_hierarchy()` - Remove departments from structure
  - UPDATE `get_user_organizations()` - Remove department_count
  - UPDATE `check_orphaned_records()` - Remove department checks

  ### Views
  - UPDATE `organization_stats` - Remove department_count

  ### Triggers
  - DROP department update triggers
  - DROP team organization-department validation trigger

  ### RLS Policies
  - DROP all policies on departments table
  - DROP all policies on department_managers table
  - ADD policies for organization admins to manage teams

  ## Security

  ### New RLS Policies for Teams
  - Organization admins can create, update, and delete teams in their organization
  - Staff members can view teams they have access to
  - Athletes can view their assigned team

  ## Migration Safety

  This migration is designed to be safe and idempotent:
  - Uses IF EXISTS for all DROP statements
  - Uses IF NOT EXISTS for all CREATE statements
  - Preserves existing team data
  - Only removes department-related data (which is confirmed to be disposable)

  ## Rollback Instructions

  If rollback is needed, you would need to:
  1. Restore the departments table structure
  2. Restore department_managers table
  3. Re-add department_id to teams
  4. Restore all related functions, views, and policies

  Note: Since department data is being deleted, a rollback would require
  restoring from a backup if the data needs to be recovered.
*/

-- ============================================================================
-- STEP 1: Drop dependent objects first (functions, triggers, policies)
-- ============================================================================

-- Drop functions that reference departments
DROP FUNCTION IF EXISTS safe_delete_department(uuid);
DROP FUNCTION IF EXISTS validate_team_org_dept_consistency() CASCADE;

-- Drop the trigger that validates team-department consistency
DROP TRIGGER IF EXISTS trigger_validate_team_organization_department ON teams;

-- Drop department-related triggers
DROP TRIGGER IF EXISTS trigger_update_department_timestamp ON departments;

-- Drop all RLS policies on departments
DROP POLICY IF EXISTS "Users can view departments in their organizations" ON departments;
DROP POLICY IF EXISTS "Organization admins can manage departments" ON departments;

-- Drop all RLS policies on department_managers
DROP POLICY IF EXISTS "Users can view their department manager assignments" ON department_managers;
DROP POLICY IF EXISTS "Organization admins can manage department managers" ON department_managers;

-- ============================================================================
-- STEP 2: Modify teams table structure
-- ============================================================================

-- Add new columns to teams table
DO $$
BEGIN
  -- Add description column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'description'
  ) THEN
    ALTER TABLE teams ADD COLUMN description text DEFAULT '';
  END IF;

  -- Add settings column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'settings'
  ) THEN
    ALTER TABLE teams ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Remove department_id column from teams
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'department_id'
  ) THEN
    -- First remove any foreign key constraint
    ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_department_id_fkey;
    -- Then drop the column
    ALTER TABLE teams DROP COLUMN department_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop department-related tables
-- ============================================================================

-- Drop department_managers table (no longer needed)
DROP TABLE IF EXISTS department_managers CASCADE;

-- Drop departments table
DROP TABLE IF EXISTS departments CASCADE;

-- Drop the index that's no longer needed
DROP INDEX IF EXISTS idx_teams_department_id;

-- ============================================================================
-- STEP 4: Update organization_members role constraint
-- ============================================================================

-- Drop existing constraint and recreate without 'department_manager'
DO $$
BEGIN
  -- Drop the old constraint
  ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;

  -- Add new constraint with only organization_admin and viewer
  ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('organization_admin', 'viewer'));
END $$;

-- ============================================================================
-- STEP 5: Update or recreate database functions
-- ============================================================================

-- Recreate get_organization_hierarchy without departments
CREATE OR REPLACE FUNCTION get_organization_hierarchy(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  org_data jsonb;
  teams_data jsonb;
  member_count_val bigint;
BEGIN
  -- Get organization basic data
  SELECT to_jsonb(o.*) INTO org_data
  FROM organizations o
  WHERE o.id = org_id;

  IF org_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get all teams directly under organization
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'settings', t.settings,
      'created_at', t.created_at
    ) ORDER BY t.name
  ), '[]'::jsonb) INTO teams_data
  FROM teams t
  WHERE t.organization_id = org_id;

  -- Get member count
  SELECT COUNT(*) INTO member_count_val
  FROM organization_members
  WHERE organization_id = org_id;

  -- Build result
  result := org_data || jsonb_build_object(
    'teams', teams_data,
    'member_count', member_count_val
  );

  RETURN result;
END;
$$;

-- Recreate get_user_organizations without department_count
CREATE OR REPLACE FUNCTION get_user_organizations(user_uuid uuid)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  user_role text,
  member_count bigint,
  team_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM teams WHERE organization_id = o.id)
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = user_uuid
  ORDER BY o.name;
END;
$$;

-- Update check_orphaned_records to remove department checks
CREATE OR REPLACE FUNCTION check_orphaned_records()
RETURNS TABLE (
  record_type text,
  record_id uuid,
  issue text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for teams without organizations
  RETURN QUERY
  SELECT
    'team'::text,
    t.id,
    'Team has no organization assigned'::text
  FROM teams t
  WHERE t.organization_id IS NULL;

  -- Check for organization_members referencing non-existent organizations
  RETURN QUERY
  SELECT
    'organization_member'::text,
    om.id,
    'Organization member references non-existent organization'::text
  FROM organization_members om
  LEFT JOIN organizations o ON om.organization_id = o.id
  WHERE o.id IS NULL;

  -- Check for organization_members referencing non-existent users
  RETURN QUERY
  SELECT
    'organization_member'::text,
    om.id,
    'Organization member references non-existent user'::text
  FROM organization_members om
  LEFT JOIN users u ON om.user_id = u.id
  WHERE u.id IS NULL;

  RETURN;
END;
$$;

-- ============================================================================
-- STEP 6: Recreate organization_stats view without department_count
-- ============================================================================

DROP VIEW IF EXISTS organization_stats;

CREATE VIEW organization_stats AS
SELECT
  o.id,
  o.name,
  o.description,
  o.created_at,
  o.updated_at,
  COALESCE(t.team_count, 0) AS team_count,
  COALESCE(m.member_count, 0) AS member_count,
  COALESCE(a.admin_count, 0) AS admin_count
FROM organizations o
LEFT JOIN (
  SELECT organization_id, COUNT(*) as team_count
  FROM teams
  GROUP BY organization_id
) t ON o.id = t.organization_id
LEFT JOIN (
  SELECT organization_id, COUNT(*) as member_count
  FROM organization_members
  GROUP BY organization_id
) m ON o.id = m.organization_id
LEFT JOIN (
  SELECT organization_id, COUNT(*) as admin_count
  FROM organization_members
  WHERE role = 'organization_admin'
  GROUP BY organization_id
) a ON o.id = a.organization_id;

-- ============================================================================
-- STEP 7: Add new RLS policies for teams management by organization admins
-- ============================================================================

-- Policy: Organization admins can create teams in their organization
DROP POLICY IF EXISTS "Organization admins can create teams in their organization" ON teams;
CREATE POLICY "Organization admins can create teams in their organization"
  ON teams FOR INSERT
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

-- Policy: Organization admins can update teams in their organization
DROP POLICY IF EXISTS "Organization admins can update teams in their organization" ON teams;
CREATE POLICY "Organization admins can update teams in their organization"
  ON teams FOR UPDATE
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

-- Policy: Organization admins can delete teams in their organization
DROP POLICY IF EXISTS "Organization admins can delete teams in their organization" ON teams;
CREATE POLICY "Organization admins can delete teams in their organization"
  ON teams FOR DELETE
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

-- Policy: Organization admins can view all teams in their organization
DROP POLICY IF EXISTS "Organization admins can view teams in their organization" ON teams;
CREATE POLICY "Organization admins can view teams in their organization"
  ON teams FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('organization_admin', 'viewer')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 8: Create helper function for organization admins to manage teams
-- ============================================================================

-- Function to get all teams in an organization
CREATE OR REPLACE FUNCTION get_organization_teams(org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  settings jsonb,
  organization_id uuid,
  created_at timestamptz,
  member_count bigint,
  staff_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.settings,
    t.organization_id,
    t.created_at,
    COUNT(DISTINCT u.id) as member_count,
    COUNT(DISTINCT stl.staff_user_id) as staff_count
  FROM teams t
  LEFT JOIN users u ON u.team_id = t.id AND u.role = 'athlete'
  LEFT JOIN staff_team_links stl ON stl.team_id = t.id
  WHERE t.organization_id = org_id
  GROUP BY t.id, t.name, t.description, t.settings, t.organization_id, t.created_at
  ORDER BY t.name;
END;
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Department tables and related objects have been removed.';
  RAISE NOTICE 'Teams now directly belong to organizations.';
  RAISE NOTICE 'Organization admins can now create and manage teams directly.';
END $$;
