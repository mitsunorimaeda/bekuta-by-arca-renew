/*
  # Fix Teams RLS for Team Access Requests

  ## Problem
  Staff users cannot view teams in their organization that they don't belong to,
  preventing them from requesting access to those teams.

  ## Solution
  Add a new RLS policy that allows organization members to view all teams
  within their organization, enabling the team access request feature.

  ## Changes
  - Add new SELECT policy: "Organization members can view all teams in their organization"
    - Allows any authenticated user who is a member of an organization to view all teams in that organization
    - Uses organization_members table to check membership

  ## Security
  - Only allows viewing teams within the user's own organization
  - Does not grant any modification permissions
  - Maintains existing admin and user-specific policies
*/

-- ============================================================================
-- Add policy for organization members to view all teams in their organization
-- ============================================================================

CREATE POLICY "Organization members can view all teams in their organization"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
