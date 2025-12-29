/*
  # Fix users table UPDATE permissions for team management

  1. Problem
    - Admin users cannot update users.team_id to manage team assignments
    - Current policy checks auth.users.raw_user_meta_data which doesn't contain role
    - Role is stored in users.role column

  2. Changes
    - Drop existing admin policy that uses incorrect role check
    - Create new policy that checks users.role = 'admin'
    - Add specific policy for staff to update team_id for athletes in their organization

  3. Security
    - Admin users can update all user fields
    - Staff users can only update team_id for athletes in their organization
    - Users can still update their own profile
*/

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admin users can manage all users" ON users;

-- Create corrected admin policy that checks users.role
CREATE POLICY "Admin users can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Create policy for staff to update team_id for athletes in their organization
DROP POLICY IF EXISTS "Staff can update athlete team assignments" ON public.users;

CREATE POLICY "Staff can update athlete team assignments"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    role = 'athlete'
    AND EXISTS (
      SELECT 1
      FROM public.users AS staff
      JOIN public.organization_members AS staff_org ON staff.id = staff_org.user_id
      JOIN public.organization_members AS athlete_org ON athlete_org.user_id = public.users.id
      WHERE staff.id = public.current_app_user_id()          -- ←ここも統一（超重要）
      AND staff.role IN ('staff', 'admin')
      AND staff_org.organization_id = athlete_org.organization_id
    )
  )
  WITH CHECK (
    role = 'athlete'
    AND EXISTS (
      SELECT 1
      FROM public.users AS staff
      JOIN public.organization_members AS staff_org ON staff.id = staff_org.user_id
      JOIN public.organization_members AS athlete_org ON athlete_org.user_id = public.users.id
      WHERE staff.id = public.current_app_user_id()          -- ←ここも統一
      AND staff.role IN ('staff', 'admin')
      AND staff_org.organization_id = athlete_org.organization_id
    )
  );