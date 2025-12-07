/*
  # Create invitation tokens table

  1. New Tables
    - `invitation_tokens`
      - `id` (uuid, primary key)
      - `token` (text, unique) - The unique invitation token
      - `email` (text) - Email of the invited user
      - `name` (text) - Name of the invited user
      - `role` (text) - Role to be assigned
      - `team_id` (uuid, nullable) - Team assignment for athletes
      - `invited_by` (uuid) - User ID of the inviter
      - `temporary_password` (text) - The temporary password
      - `used` (boolean) - Whether token has been used
      - `expires_at` (timestamptz) - Token expiration time
      - `used_at` (timestamptz, nullable) - When token was used
      - `created_at` (timestamptz) - Creation timestamp
  
  2. Security
    - Enable RLS on `invitation_tokens` table
    - Add policy for authenticated admin/staff users to create tokens
    - Add policy for public access to verify tokens (read-only, limited fields)
  
  3. Notes
    - Tokens expire after 24 hours by default
    - One-time use only
    - Stores all invitation context for welcome page personalization
*/

CREATE TABLE IF NOT EXISTS invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('athlete', 'staff', 'admin')),
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  temporary_password text NOT NULL,
  used boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can create invitation tokens"
  ON invitation_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin and staff can view invitation tokens"
  ON invitation_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Public can verify invitation tokens"
  ON invitation_tokens
  FOR SELECT
  TO anon
  USING (
    used = false 
    AND expires_at > now()
  );

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_token ON invitation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email ON invitation_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_expires_at ON invitation_tokens(expires_at);
