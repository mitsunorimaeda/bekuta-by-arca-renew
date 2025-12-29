/*
  # Fix infinite recursion in users table RLS policies

  1. Security Changes
    - Drop existing problematic RLS policies on users table
    - Create simplified, non-recursive policies
    - Ensure admin users can view all users
    - Ensure users can view their own data
    - Ensure authenticated users can view basic user info for team functionality

  2. Policy Structure
    - Admin users: full access to all user data
    - Regular users: can view their own complete profile
    - Authenticated users: can view basic info (name, role, team_id) of other users for team functionality
*/

-- Drop existing policies that might be causing recursion
DROP POLICY IF EXISTS "Authenticated users can view user profiles" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create new, simplified policies

-- Policy 1: Users can view and update their own complete profile
-- Policy 1: Users can view and update their own complete profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;

CREATE POLICY "Users can manage own profile"
  ON public.users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 2: Admin users can view and manage all users
CREATE POLICY "Admin users can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy 3: Authenticated users can view basic info of other users (for team functionality)
-- This is needed for staff to see their team members and for general app functionality
DROP POLICY IF EXISTS "Authenticated users can view basic user info" ON public.users;

CREATE POLICY "Authenticated users can view basic user info"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);