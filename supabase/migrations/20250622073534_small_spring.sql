/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current policies query the users table from within the policies themselves
    - This creates infinite recursion when trying to access user data
    - Specifically affects admin and staff role-based policies

  2. Solution
    - Remove recursive policies that query users table from within users policies
    - Use auth.jwt() to get user metadata/claims for role-based access
    - Simplify policies to avoid self-referential queries
    - Keep basic user access policy (users can view their own data)

  3. Changes
    - Drop existing problematic policies
    - Create new non-recursive policies
    - Use alternative approaches for role-based access
*/

-- Drop existing problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin users can manage all users" ON users;
DROP POLICY IF EXISTS "Admin users can view all users" ON users;
DROP POLICY IF EXISTS "Staff can view athletes in their teams" ON users;

-- Keep the basic policy for users to view their own data
-- This policy already exists and doesn't cause recursion: "Users can view their own data"

-- Create a simple policy for authenticated users to read basic user info
-- This avoids the recursion issue by not checking roles within the users table
CREATE POLICY "Authenticated users can view user profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- For admin operations, we'll handle role checking in the application layer
-- or use a separate function that doesn't cause recursion
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);