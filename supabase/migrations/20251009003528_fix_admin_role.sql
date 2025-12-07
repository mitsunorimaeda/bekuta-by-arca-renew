/*
  # Fix admin role constraint

  1. Changes
    - Alter users table role constraint to allow 'admin' role
    - This enables admin users to be created in the system
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('athlete', 'staff', 'admin'));
