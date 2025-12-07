/*
  # Fix Teams RLS Policies for Admin Users

  ## Purpose
  Fix the RLS policies for teams table to correctly check admin users.
  The issue is that auth.uid() returns UUID type, but users.user_id is text type.
  We need to cast auth.uid() to text for comparison.

  ## Changes
  - Update all teams RLS policies to correctly check admin users using CAST
*/

-- ============================================================================
-- Fix RLS policies for teams table
-- ============================================================================

-- Policy: Organization admins can create teams in their organization
DROP POLICY IF EXISTS "Organization admins can create teams in their organization" ON teams;
CREATE POLICY "Organization admins can create teams in their organization"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT id FROM users WHERE user_id = auth.uid()::text)
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.user_id = auth.uid()::text AND users.role = 'admin'
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
      WHERE user_id = (SELECT id FROM users WHERE user_id = auth.uid()::text)
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.user_id = auth.uid()::text AND users.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT id FROM users WHERE user_id = auth.uid()::text)
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.user_id = auth.uid()::text AND users.role = 'admin'
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
      WHERE user_id = (SELECT id FROM users WHERE user_id = auth.uid()::text)
      AND role = 'organization_admin'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.user_id = auth.uid()::text AND users.role = 'admin'
    )
  );

-- Policy: Organization admins can view teams in their organization
DROP POLICY IF EXISTS "Organization admins can view teams in their organization" ON teams;
CREATE POLICY "Organization admins can view teams in their organization"
  ON teams FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT id FROM users WHERE user_id = auth.uid()::text)
      AND role IN ('organization_admin', 'viewer')
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.user_id = auth.uid()::text AND users.role = 'admin'
    )
  );
