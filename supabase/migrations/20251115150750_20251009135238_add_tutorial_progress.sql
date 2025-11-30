/*
  # Add Tutorial Progress Tracking

  1. New Tables
    - `tutorial_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `role` (text, user role: athlete/staff/admin)
      - `completed_steps` (jsonb, array of completed step IDs)
      - `current_step` (text, current step ID)
      - `is_completed` (boolean, whether tutorial is fully completed)
      - `skipped` (boolean, whether user skipped tutorial)
      - `last_updated` (timestamptz, last update timestamp)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on `tutorial_progress` table
    - Add policies for users to read and update their own progress
    - Add policy for admins to view all tutorial progress

  3. Changes
    - Users can track their onboarding tutorial progress
    - Progress is saved to database for cross-device sync
    - Admins can monitor tutorial completion rates
*/

-- Create tutorial_progress table
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('athlete', 'staff', 'admin')),
  completed_steps jsonb DEFAULT '[]'::jsonb,
  current_step text DEFAULT NULL,
  is_completed boolean DEFAULT false,
  skipped boolean DEFAULT false,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_user_id ON tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_role ON tutorial_progress(role);
CREATE INDEX IF NOT EXISTS idx_tutorial_progress_completed ON tutorial_progress(is_completed);

-- Enable RLS
ALTER TABLE tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tutorial progress
CREATE POLICY "Users can view own tutorial progress"
  ON tutorial_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own tutorial progress
CREATE POLICY "Users can create own tutorial progress"
  ON tutorial_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tutorial progress
CREATE POLICY "Users can update own tutorial progress"
  ON tutorial_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all tutorial progress
CREATE POLICY "Admins can view all tutorial progress"
  ON tutorial_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_tutorial_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on every update
DROP TRIGGER IF EXISTS trigger_update_tutorial_progress_timestamp ON tutorial_progress;
CREATE TRIGGER trigger_update_tutorial_progress_timestamp
  BEFORE UPDATE ON tutorial_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_tutorial_progress_timestamp();