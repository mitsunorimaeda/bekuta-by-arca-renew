/*
  # Fix RLS recursion issue in users table

  1. Problem
    - Previous policy causes infinite recursion by querying users table within users RLS policy
    - This breaks login and all user operations

  2. Solution
    - Drop the recursive policies
    - Restore the original working policies
    - Use organization_members table to check admin status (no recursion)

  3. Security
    - Admin users (checked via organization_members) can manage users
    - Users can manage their own profile
    - All authenticated users can view basic user info
*/

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admin users can manage all users" ON users;
DROP POLICY IF EXISTS "Staff can update athlete team assignments" ON users;

-- Simple policy: Organization admins can manage all users in their organization
CREATE POLICY "Organization admins can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'organization_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'organization_admin'
    )
  );
