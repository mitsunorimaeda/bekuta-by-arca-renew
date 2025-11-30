/*
  # Fix menstrual_cycles organization_id to allow NULL

  1. Changes
    - Make organization_id column nullable in menstrual_cycles table
    - This allows users without an organization to track their menstrual cycles
  
  2. Security
    - Maintains existing RLS policies
    - No changes to access control
*/

-- Make organization_id nullable
ALTER TABLE menstrual_cycles 
ALTER COLUMN organization_id DROP NOT NULL;
