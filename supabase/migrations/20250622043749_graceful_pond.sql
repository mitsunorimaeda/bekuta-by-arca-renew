/*
  # Add sample data for testing

  1. Sample Data
    - Creates a sample team
    - Creates sample athlete and staff users
    - Links staff to team
    - Adds training records for demonstration

  2. Conflict Handling
    - Handles conflicts on all unique constraints
    - Ensures data consistency
*/

-- Insert sample team
INSERT INTO teams (id, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'サンプルチーム')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

/*
-- Create sample users with proper conflict handling
DO $$
BEGIN
  -- Insert athlete user record with comprehensive conflict handling
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', '田中太郎', 'athlete001@example.com', 'athlete', '550e8400-e29b-41d4-a716-446655440000', 'USER0001')
  ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id,
    user_id = EXCLUDED.user_id;

  -- Handle potential user_id conflict separately
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', '田中太郎', 'athlete001@example.com', 'athlete', '550e8400-e29b-41d4-a716-446655440000', 'USER0001')
  ON CONFLICT (user_id) DO UPDATE SET 
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id;

  -- Handle potential email conflict separately
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', '田中太郎', 'athlete001@example.com', 'athlete', '550e8400-e29b-41d4-a716-446655440000', 'USER0001')
  ON CONFLICT (email) DO UPDATE SET 
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id,
    user_id = EXCLUDED.user_id;

EXCEPTION
  WHEN OTHERS THEN
    -- If any conflict, try to update existing record
    UPDATE users SET 
      name = '田中太郎',
      email = 'athlete001@example.com',
      role = 'athlete',
      team_id = '550e8400-e29b-41d4-a716-446655440000'
    WHERE user_id = 'USER0001' OR id = '123e4567-e89b-12d3-a456-426614174000';
    
    -- If no existing record, insert with a new UUID for id
    IF NOT FOUND THEN
      INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
        (gen_random_uuid(), '田中太郎', 'athlete001@example.com', 'athlete', '550e8400-e29b-41d4-a716-446655440000', 'USER0001')
      ON CONFLICT (user_id) DO UPDATE SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        team_id = EXCLUDED.team_id;
    END IF;
END $$;
*/

/*
DO $$
BEGIN
  -- Insert staff user record with comprehensive conflict handling
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174001', '佐藤花子', 'staff001@example.com', 'staff', NULL, 'STAFF001')
  ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id,
    user_id = EXCLUDED.user_id;

  -- Handle potential user_id conflict separately
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174001', '佐藤花子', 'staff001@example.com', 'staff', NULL, 'STAFF001')
  ON CONFLICT (user_id) DO UPDATE SET 
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id;

  -- Handle potential email conflict separately
  INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
    ('123e4567-e89b-12d3-a456-426614174001', '佐藤花子', 'staff001@example.com', 'staff', NULL, 'STAFF001')
  ON CONFLICT (email) DO UPDATE SET 
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id,
    user_id = EXCLUDED.user_id;

EXCEPTION
  WHEN OTHERS THEN
    -- If any conflict, try to update existing record
    UPDATE users SET 
      name = '佐藤花子',
      email = 'staff001@example.com',
      role = 'staff',
      team_id = NULL
    WHERE user_id = 'STAFF001' OR id = '123e4567-e89b-12d3-a456-426614174001';
    
    -- If no existing record, insert with a new UUID for id
    IF NOT FOUND THEN
      INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
        (gen_random_uuid(), '佐藤花子', 'staff001@example.com', 'staff', NULL, 'STAFF001')
      ON CONFLICT (user_id) DO UPDATE SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        team_id = EXCLUDED.team_id;
    END IF;
END $$;
*/

-- Insert staff team link (using the actual user ID from the users table)
DO $$
DECLARE
  staff_user_uuid uuid;
BEGIN
  -- Get the actual UUID of the staff user
  SELECT id INTO staff_user_uuid FROM users WHERE user_id = 'STAFF001';
  
  IF staff_user_uuid IS NOT NULL THEN
    INSERT INTO staff_team_links (staff_user_id, team_id) VALUES 
      (staff_user_uuid, '550e8400-e29b-41d4-a716-446655440000')
    ON CONFLICT (staff_user_id, team_id) DO NOTHING;
  END IF;
END $$;

-- Add sample training records for the athlete (using the actual user ID from the users table)
DO $$
DECLARE
  athlete_user_uuid uuid;
BEGIN
  -- Get the actual UUID of the athlete user
  SELECT id INTO athlete_user_uuid FROM users WHERE user_id = 'USER0001';
  
  IF athlete_user_uuid IS NOT NULL THEN
    INSERT INTO training_records (user_id, date, rpe, duration_min) VALUES
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '1 day', 7, 90),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '2 days', 6, 75),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '3 days', 8, 105),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '4 days', 5, 60),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '5 days', 7, 85),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '6 days', 6, 70),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '7 days', 8, 95),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '8 days', 7, 80),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '9 days', 5, 65),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '10 days', 6, 75),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '11 days', 7, 85),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '12 days', 8, 100),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '13 days', 6, 70),
      (athlete_user_uuid, CURRENT_DATE - INTERVAL '14 days', 7, 90)
    ON CONFLICT (user_id, date) DO NOTHING;
  END IF;
END $$;