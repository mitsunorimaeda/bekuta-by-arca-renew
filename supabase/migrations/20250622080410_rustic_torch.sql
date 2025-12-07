/*
  # Fix User Self-Read Policy

  1. Security Policy Update
    - Ensure authenticated users can read their own user profile data
    - This is required for the create-user edge function to verify admin status
    - The policy allows users to SELECT their own row using auth.uid() = id

  2. Changes
    - Add or update policy to allow authenticated users to read their own data
    - This enables the edge function to properly verify the calling user's role
*/

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read their own user profile" ON users;

-- Create a policy that allows authenticated users to read their own profile
CREATE POLICY "Allow authenticated users to read their own user profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Ensure the existing "Authenticated users can view basic user info" policy doesn't conflict
-- This policy allows viewing basic info of all users, which is needed for team management
-- The new policy specifically ensures users can read their own complete profile