/*
  # Fix Team Assignments RLS for Organization Admins

  ## Problem
  The RLS policies on team_member_assignments table reference organization_members directly,
  which can cause recursion issues. The assign_user_to_team function is SECURITY DEFINER
  but the RLS policies still need to be checked and may fail for organization admins.

  ## Solution
  Update the RLS policies to use the is_organization_admin helper function which is
  SECURITY DEFINER and avoids recursion issues.

  ## Changes
  - Drop existing problematic policies on team_member_assignments
  - Recreate policies using is_organization_admin function
  - Ensure organization admins can properly assign users to teams
*/

-- Drop existing policies on team_member_assignments
DROP POLICY IF EXISTS "Organization admins can view team assignments in their org" ON team_member_assignments;
DROP POLICY IF EXISTS "Organization admins can create team assignments" ON team_member_assignments;
DROP POLICY IF EXISTS "Organization admins can update team assignments" ON team_member_assignments;
DROP POLICY IF EXISTS "Organization admins can delete team assignments" ON team_member_assignments;

-- Recreate policies using the is_organization_admin helper function

-- Organization admins can view assignments in their organization
CREATE POLICY "Organization admins can view team assignments in their org"
  ON team_member_assignments FOR SELECT
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Organization admins can create assignments in their organization
CREATE POLICY "Organization admins can create team assignments"
  ON team_member_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Organization admins can update assignments in their organization
CREATE POLICY "Organization admins can update team assignments"
  ON team_member_assignments FOR UPDATE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Organization admins can delete assignments in their organization
CREATE POLICY "Organization admins can delete team assignments"
  ON team_member_assignments FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
