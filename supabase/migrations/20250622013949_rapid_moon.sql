/*
  # ACWR Monitor Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `name` (text)
      - `email` (text, unique)
      - `role` (text, athlete/staff)
      - `team_id` (uuid, for athletes)
      - `created_at` (timestamp)
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamp)
    - `staff_team_links`
      - `id` (uuid, primary key)
      - `staff_user_id` (uuid, references users)
      - `team_id` (uuid, references teams)
      - `created_at` (timestamp)
    - `training_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `date` (date)
      - `rpe` (integer, 1-10)
      - `duration_min` (integer)
      - `load` (numeric, calculated)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Athletes can only access their own data
    - Staff can access their team members' data
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('athlete', 'staff')),
  team_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now()
);

-- Create staff_team_links table for many-to-many relationship
CREATE TABLE IF NOT EXISTS staff_team_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_user_id, team_id)
);

-- Create training_records table
CREATE TABLE IF NOT EXISTS training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  rpe integer NOT NULL CHECK (rpe >= 1 AND rpe <= 10),
  duration_min integer NOT NULL CHECK (duration_min > 0),
  load numeric GENERATED ALWAYS AS (rpe * duration_min) STORED,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_team_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

-- Create policies for teams
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
      UNION
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Create policies for users
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Staff can view athletes in their teams"
  ON users FOR SELECT
  TO authenticated
  USING (
    role = 'athlete' AND team_id IN (
      SELECT team_id FROM staff_team_links WHERE staff_user_id = auth.uid()
    )
  );

-- Create policies for staff_team_links
CREATE POLICY "Staff can view their team links"
  ON staff_team_links FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid());

-- Create policies for training_records
CREATE POLICY "Athletes can manage their own training records"
  ON training_records FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view training records of their team members"
  ON training_records FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      JOIN staff_team_links stl ON u.team_id = stl.team_id
      WHERE stl.staff_user_id = auth.uid()
    )
  );

-- Insert sample data
INSERT INTO teams (name) VALUES 
('サッカーチームA'),
('バスケットボールチームB'),
('陸上競技チームC')
ON CONFLICT DO NOTHING;