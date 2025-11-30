/*
  # Fix user_id sequence and default value

  1. Create Sequence
    - Create a sequence for generating sequential user IDs
    - Set proper starting value
    - Handle existing user_id values

  2. Update Default Value
    - Set default value for user_id column to use sequence
    - Ensure new users get sequential IDs automatically

  3. Handle Existing Data
    - Update existing users with proper sequential IDs if needed
*/

-- Create sequence for user_id generation
CREATE SEQUENCE IF NOT EXISTS users_user_id_seq;

-- Get the current maximum number from existing user_id values
DO $$
DECLARE
  max_num integer := 0;
  user_rec RECORD;
BEGIN
  -- Find the highest number in existing user_id values
  FOR user_rec IN 
    SELECT user_id FROM users WHERE user_id ~ '^USER[0-9]+$'
  LOOP
    max_num := GREATEST(max_num, CAST(SUBSTRING(user_rec.user_id FROM 5) AS integer));
  END LOOP;
  
  -- Set sequence to start from next number
  PERFORM setval('users_user_id_seq', max_num + 1, false);
END $$;

-- Set default value for user_id column
ALTER TABLE users ALTER COLUMN user_id SET DEFAULT 'USER' || LPAD(nextval('users_user_id_seq')::text, 4, '0');

-- Update any NULL user_id values with sequential IDs
UPDATE users 
SET user_id = 'USER' || LPAD(nextval('users_user_id_seq')::text, 4, '0')
WHERE user_id IS NULL;