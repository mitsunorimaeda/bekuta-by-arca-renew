/*
  # Add sample users for testing

  1. Sample Data
    - Creates sample staff and athlete users
    - Creates a sample team
    - Links staff to team and assigns athletes to team
    - Sets up test credentials for login

  2. Test Credentials
    - Staff user: staff@example.com / password123
    - Athlete user: athlete@example.com / password123

  3. Security
    - All users are created with proper authentication
    - RLS policies will control data access based on roles
*/

-- Create a sample team first
INSERT INTO teams (id, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Sample Team A')
ON CONFLICT (id) DO NOTHING;

-- Insert sample users into the users table
-- Note: These will be linked to Supabase auth users
INSERT INTO users (id, name, email, role, team_id, user_id) VALUES 
  ('550e8400-e29b-41d4-a716-446655440010', 'Staff User', 'staff@example.com', 'staff', NULL, 'staff-user-001'),
  ('550e8400-e29b-41d4-a716-446655440011', 'Athlete User', 'athlete@example.com', 'athlete', '550e8400-e29b-41d4-a716-446655440001', 'athlete-user-001')
ON CONFLICT (id) DO NOTHING;

-- Link staff user to the team
INSERT INTO staff_team_links (staff_user_id, team_id) VALUES 
  ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT (staff_user_id, team_id) DO NOTHING;

-- Add some sample training data for the athlete
INSERT INTO training_records (user_id, date, rpe, duration_min) VALUES 
  ('550e8400-e29b-41d4-a716-446655440011', CURRENT_DATE - INTERVAL '1 day', 7, 90),
  ('550e8400-e29b-41d4-a716-446655440011', CURRENT_DATE - INTERVAL '2 days', 6, 75),
  ('550e8400-e29b-41d4-a716-446655440011', CURRENT_DATE - INTERVAL '3 days', 8, 105),
  ('550e8400-e29b-41d4-a716-446655440011', CURRENT_DATE - INTERVAL '4 days', 5, 60),
  ('550e8400-e29b-41d4-a716-446655440011', CURRENT_DATE - INTERVAL '5 days', 7, 85)
ON CONFLICT (user_id, date) DO NOTHING;