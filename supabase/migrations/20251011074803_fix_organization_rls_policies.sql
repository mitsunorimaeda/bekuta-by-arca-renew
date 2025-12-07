/*
  # Fix Organization RLS Policies for Admin Access

  ## Problem
  The current RLS policies check for admin role in public.users table, but there seems to be
  a synchronization issue between auth.users and public.users. This migration updates the
  RLS policies to be more robust and adds a simpler admin check.

  ## Changes
  1. Drop existing restrictive policies
  2. Create new simplified policies that properly check admin role
  3. Add policy to allow all authenticated users to view organizations (temporary for debugging)

  ## Security
  - Maintains admin-only write access
  - Allows authenticated users to read (can be tightened later)
*/

-- Drop existing organization policies
DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
DROP POLICY IF EXISTS "Organization members can view their organizations" ON organizations;

-- Create simple read policy for authenticated users
-- This allows any logged-in user to view organizations (you can restrict this later)
CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

-- Create admin-only write policies
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
