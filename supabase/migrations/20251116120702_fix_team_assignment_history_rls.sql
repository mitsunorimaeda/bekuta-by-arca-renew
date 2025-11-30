/*
  # Fix Team Assignment History RLS for Organization Admins

  ## Problem
  The RLS policy on team_assignment_history table references organization_members directly,
  which can cause recursion issues when used within SECURITY DEFINER functions.

  ## Solution
  Update the RLS policy to use the is_organization_admin helper function.

  ## Changes
  - Drop existing problematic policy
  - Recreate policy using is_organization_admin function
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Organization admins can view team assignment history" ON team_assignment_history;

-- Recreate policy using the helper function
CREATE POLICY "Organization admins can view team assignment history"
  ON team_assignment_history FOR SELECT
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
