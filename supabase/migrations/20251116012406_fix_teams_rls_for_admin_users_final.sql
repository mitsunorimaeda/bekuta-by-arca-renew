/*
  # Fix Teams RLS Policies for Admin Users - Final Fix

  ## Purpose
  Allow admin users (role='admin' in users table) to create, update, and delete teams
  without needing to be members of an organization.

  ## Problem
  Admin users were unable to create teams because the RLS policies required them to be
  organization members. However, admin users should have global access.

  ## Changes
  - Simplify admin check: Just check if users.role = 'admin' directly
  - No need to check organization membership for admin users
*/

-- ============================================================================
-- Fix RLS policies for teams table - Admin users
-- ============================================================================

-- Policy: Organization admins and global admins can create teams
DROP POLICY IF EXISTS "Organization admins can create teams in their organization" ON teams;
CREATE POLICY "Organization admins can create teams in their organization"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Global admin users can create teams anywhere
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid()::text 
      AND users.role = 'admin'
    )
    OR
    -- Organization admins can create teams in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.user_id = auth.uid()::text
      AND om.role = 'organization_admin'
    )
  );

-- Policy: Organization admins and global admins can update teams
DROP POLICY IF EXISTS "Organization admins can update teams in their organization" ON teams;
CREATE POLICY "Organization admins can update teams in their organization"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    -- Global admin users can update any team
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid()::text 
      AND users.role = 'admin'
    )
    OR
    -- Organization admins can update teams in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.user_id = auth.uid()::text
      AND om.role = 'organization_admin'
    )
  )
  WITH CHECK (
    -- Global admin users can update any team
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid()::text 
      AND users.role = 'admin'
    )
    OR
    -- Organization admins can update teams in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.user_id = auth.uid()::text
      AND om.role = 'organization_admin'
    )
  );

-- Policy: Organization admins and global admins can delete teams
DROP POLICY IF EXISTS "Organization admins can delete teams in their organization" ON teams;
CREATE POLICY "Organization admins can delete teams in their organization"
  ON teams FOR DELETE
  TO authenticated
  USING (
    -- Global admin users can delete any team
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid()::text 
      AND users.role = 'admin'
    )
    OR
    -- Organization admins can delete teams in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.user_id = auth.uid()::text
      AND om.role = 'organization_admin'
    )
  );

-- Policy: Organization members and global admins can view teams
DROP POLICY IF EXISTS "Organization admins can view teams in their organization" ON teams;
CREATE POLICY "Organization admins can view teams in their organization"
  ON teams FOR SELECT
  TO authenticated
  USING (
    -- Global admin users can view any team
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid()::text 
      AND users.role = 'admin'
    )
    OR
    -- Organization members can view teams in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.user_id = auth.uid()::text
      AND om.role IN ('organization_admin', 'viewer')
    )
  );
