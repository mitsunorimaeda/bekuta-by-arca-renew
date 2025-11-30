/*
  # Sync auth.users with public.users

  1. Purpose
    - Automatically synchronize auth.users with public.users table
    - Ensure every authenticated user has a corresponding record in public.users
    - Handle user metadata from auth system

  2. Changes
    - Create function to handle new user creation
    - Create trigger on auth.users insert
    - Sync existing users from auth.users to public.users

  3. Security
    - Function runs with security definer privileges
    - Maintains data integrity between auth and public schemas
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_name text;
  user_role text;
  user_team_id uuid;
BEGIN
  -- Extract metadata from raw_user_meta_data
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');
  user_team_id := (NEW.raw_user_meta_data->>'team_id')::uuid;

  -- Insert into public.users
  INSERT INTO public.users (id, name, email, role, team_id)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    user_team_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users from auth.users to public.users
DO $$
DECLARE
  auth_user RECORD;
  user_name text;
  user_role text;
  user_team_id uuid;
  team_exists boolean;
BEGIN
  -- Check if we have any teams, if not create a default one
  SELECT EXISTS(SELECT 1 FROM teams LIMIT 1) INTO team_exists;
  
  IF NOT team_exists THEN
    INSERT INTO teams (id, name) VALUES 
      (gen_random_uuid(), 'デフォルトチーム')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sync all existing auth.users to public.users
  FOR auth_user IN SELECT * FROM auth.users LOOP
    user_name := COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1));
    user_role := COALESCE(auth_user.raw_user_meta_data->>'role', 'athlete');
    user_team_id := (auth_user.raw_user_meta_data->>'team_id')::uuid;

    -- If no team_id in metadata, assign to first available team
    IF user_team_id IS NULL THEN
      SELECT id INTO user_team_id FROM teams LIMIT 1;
    END IF;

    INSERT INTO public.users (id, name, email, role, team_id)
    VALUES (
      auth_user.id,
      user_name,
      auth_user.email,
      user_role,
      user_team_id
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      team_id = EXCLUDED.team_id;
  END LOOP;
END $$;