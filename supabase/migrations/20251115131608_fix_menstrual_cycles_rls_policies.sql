/*
  # Fix Menstrual Cycles RLS Policies

  ## Problem
  The menstrual_cycles table RLS policies were using incorrect user ID comparison:
  - Used: `users.user_id = (auth.uid())::text` (comparing text user_id with UUID)
  - Should be: `users.id = auth.uid()` (comparing UUID with UUID)

  ## Changes
  1. Drop existing incorrect policies
  2. Recreate policies with correct user ID comparison
  
  ## Security
  - Maintains strict user data access control
  - Users can only access their own menstrual cycle data
  - Admin access added for management purposes
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can view own menstrual cycle data" ON menstrual_cycles;
DROP POLICY IF EXISTS "Users can insert own menstrual cycle data" ON menstrual_cycles;
DROP POLICY IF EXISTS "Users can update own menstrual cycle data" ON menstrual_cycles;
DROP POLICY IF EXISTS "Users can delete own menstrual cycle data" ON menstrual_cycles;

-- Create corrected policies
CREATE POLICY "Users can view own menstrual cycle data"
  ON menstrual_cycles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own menstrual cycle data"
  ON menstrual_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own menstrual cycle data"
  ON menstrual_cycles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own menstrual cycle data"
  ON menstrual_cycles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add admin access policy
CREATE POLICY "Admins can view all menstrual cycle data"
  ON menstrual_cycles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Staff can view team menstrual cycle data"
  ON menstrual_cycles
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id
      FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );
