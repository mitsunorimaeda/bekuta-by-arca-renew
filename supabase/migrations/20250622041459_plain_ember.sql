/*
  # Add user_id field to users table

  1. New Columns
    - `user_id` (text, unique, not null) - User-friendly ID like USER0001, USER0002

  2. Changes
    - Add user_id column to users table
    - Create unique constraint on user_id
    - Generate user_id for existing users using sequential numbering
    - Set user_id as NOT NULL after populating existing records

  3. Notes
    - Existing users will get auto-generated user IDs in format USER0001, USER0002, etc.
    - New users should have user_id set when creating the user record
*/

-- Add user_id column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN user_id text;
  END IF;
END $$;

-- Generate user_id for existing users using a different approach
DO $$
DECLARE
  user_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR user_record IN 
    SELECT id FROM users WHERE user_id IS NULL ORDER BY created_at
  LOOP
    UPDATE users 
    SET user_id = 'USER' || LPAD(counter::text, 4, '0')
    WHERE id = user_record.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Create unique constraint on user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_user_id_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Make user_id NOT NULL after populating existing records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;