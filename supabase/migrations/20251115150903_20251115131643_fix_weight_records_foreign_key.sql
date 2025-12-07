/*
  # Fix Weight Records Foreign Key

  ## Problem
  The weight_records table was missing a proper foreign key constraint to public.users table.
  According to the table list output, it was referencing auth.users instead of public.users.

  ## Changes
  1. Add foreign key constraint from weight_records.user_id to public.users.id
  2. Ensure cascading delete for data integrity
  
  ## Security
  - Maintains data referential integrity
  - Ensures weight records are properly linked to user profiles
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'weight_records_user_id_fkey' 
    AND table_name = 'weight_records'
    AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE weight_records
      ADD CONSTRAINT weight_records_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;