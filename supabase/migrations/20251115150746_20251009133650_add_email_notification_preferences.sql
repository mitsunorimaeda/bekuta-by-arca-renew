/*
  # Add Email Notification Preferences

  1. Changes
    - Add `email_notifications` column to `users` table to store notification preferences
    - Add `last_alert_email_sent` column to track when alert emails were sent
    
  2. Schema
    - `email_notifications` (jsonb): Stores preferences for different notification types
      - `invitations`: boolean (default: true)
      - `alerts`: boolean (default: true)
      - `password_reset`: boolean (default: true)
      - `weekly_summary`: boolean (default: false)
    - `last_alert_email_sent` (timestamptz): Timestamp of last alert email sent
    
  3. Security
    - Users can read and update their own notification preferences
    - Admins can read all users' preferences
*/

-- Add email notification preferences column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE users ADD COLUMN email_notifications jsonb DEFAULT '{
      "invitations": true,
      "alerts": true,
      "password_reset": true,
      "weekly_summary": false
    }'::jsonb;
  END IF;
END $$;

-- Add last alert email sent timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_alert_email_sent'
  ) THEN
    ALTER TABLE users ADD COLUMN last_alert_email_sent timestamptz;
  END IF;
END $$;

-- Create or update RLS policy for users to update their own notification preferences
DROP POLICY IF EXISTS "Users can update own notification preferences" ON users;
CREATE POLICY "Users can update own notification preferences"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);