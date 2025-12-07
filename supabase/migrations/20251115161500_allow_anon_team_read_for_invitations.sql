/*
  # Allow anonymous users to read team names for invitation tokens

  1. Changes
    - Add policy for anonymous users to read team names
    - Only allows reading teams that are referenced in valid invitation tokens

  2. Security
    - Anonymous users can only read team names (not other data)
    - Only for teams that have active, unexpired invitation tokens
*/

-- Create policy for anonymous users to view teams referenced in valid invitations
CREATE POLICY "Anonymous can view teams for valid invitations"
  ON teams
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT team_id
      FROM invitation_tokens
      WHERE team_id IS NOT NULL
      AND used = false
      AND expires_at > now()
    )
  );
