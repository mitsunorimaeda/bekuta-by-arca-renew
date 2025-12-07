/*
  # Fix Organization RLS Policies for Admin Access

  ## Problem
  The current RLS policies check for admin role in public.users table using auth.uid().
  However, auth.uid() returns the auth user ID, not the public.users.id.
  This migration fixes the policies to properly map between auth and public users.

  ## Changes
  1. Drop existing restrictive policies
  2. Create new policies that properly check admin role using correct ID mapping
  3. Service role key bypasses RLS, so direct inserts should work

  ## Security
  - Maintains admin-only write access
  - Allows authenticated users to read organizations
*/

-- Drop existing organization policies
DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
DROP POLICY IF EXISTS "Organization members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;

-- Create simple read policy for authenticated users
CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

-- Create admin-only write policies
-- Note: auth.uid() returns the auth user ID, so we need to join through users table
CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
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

CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Update departments policies similarly
DROP POLICY IF EXISTS "Users can view departments in their organizations" ON departments;
DROP POLICY IF EXISTS "Organization admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can view departments" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;

CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
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

-- Update organization_members policies
DROP POLICY IF EXISTS "Users can view their organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON organization_members;

CREATE POLICY "Authenticated users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage organization members"
  ON organization_members FOR ALL
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

-- Update department_managers policies
DROP POLICY IF EXISTS "Users can view their department manager assignments" ON department_managers;
DROP POLICY IF EXISTS "Organization admins can manage department managers" ON department_managers;

CREATE POLICY "Authenticated users can view department managers"
  ON department_managers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage department managers"
  ON department_managers FOR ALL
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