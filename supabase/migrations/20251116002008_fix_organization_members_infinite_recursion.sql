/*
  # Fix Organization Members Infinite Recursion

  ## Problem
  The RLS policies on organization_members table cause infinite recursion because they
  reference organization_members in their own USING clauses, creating a circular dependency.

  ## Solution
  Replace the problematic policies with simpler, non-recursive policies:
  1. Users can view their own memberships (direct user_id check)
  2. System admins can view all memberships
  3. Organization admins can manage memberships (will be handled separately with a function)

  ## Changes
  - Drop existing problematic policies
  - Create new non-recursive policies
  - Add helper function to check organization admin status without recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON organization_members;

-- Create a security definer function to check organization admin role
-- This avoids RLS recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role = 'organization_admin'
  );
END;
$$;

-- Create non-recursive policy for viewing own memberships
CREATE POLICY "Users can view their own organization memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create policy for organization admins to view memberships in their org
CREATE POLICY "Organization admins can view org memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create policy for inserting memberships
CREATE POLICY "Organization admins can insert memberships"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create policy for updating memberships
CREATE POLICY "Organization admins can update memberships"
  ON organization_members FOR UPDATE
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

-- Create policy for deleting memberships
CREATE POLICY "Organization admins can delete memberships"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Also fix the departments policies that have similar issues
DROP POLICY IF EXISTS "Users can view departments in their organizations" ON departments;
DROP POLICY IF EXISTS "Organization admins can manage departments" ON departments;

-- Recreate departments policies using the helper function
CREATE POLICY "Users can view departments in their organizations"
  ON departments FOR SELECT
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can update departments"
  ON departments FOR UPDATE
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

CREATE POLICY "Organization admins can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Fix department_managers policies
DROP POLICY IF EXISTS "Users can view their department manager assignments" ON department_managers;
DROP POLICY IF EXISTS "Organization admins can manage department managers" ON department_managers;

CREATE POLICY "Users can view their department manager assignments"
  ON department_managers FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_managers.department_id
      AND is_organization_admin(d.organization_id, auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can insert department managers"
  ON department_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_managers.department_id
      AND (is_organization_admin(d.organization_id, auth.uid())
           OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
    )
  );

CREATE POLICY "Organization admins can update department managers"
  ON department_managers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_managers.department_id
      AND (is_organization_admin(d.organization_id, auth.uid())
           OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_managers.department_id
      AND (is_organization_admin(d.organization_id, auth.uid())
           OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
    )
  );

CREATE POLICY "Organization admins can delete department managers"
  ON department_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departments d
      WHERE d.id = department_managers.department_id
      AND (is_organization_admin(d.organization_id, auth.uid())
           OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
    )
  );
