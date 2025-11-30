/*
  # Add Email Delivery Log Table

  1. New Tables
    - `email_delivery_log`
      - `id` (uuid, primary key)
      - `to_email` (text) - Recipient email address
      - `subject` (text) - Email subject
      - `email_type` (text) - Type of email (invitation, alert, password_reset, weekly_summary)
      - `status` (text) - Delivery status (sent, failed, simulated)
      - `resend_id` (text, nullable) - Resend API response ID
      - `error_message` (text, nullable) - Error details if failed
      - `sent_by` (uuid) - User who triggered the email
      - `sent_at` (timestamptz) - When email was sent
      - `metadata` (jsonb, nullable) - Additional data about the email

  2. Security
    - Enable RLS on `email_delivery_log` table
    - Add policy for admins to view all logs
    - Add policy for staff to view logs for their team members
    - Add policy for users to view their own email logs

  3. Indexes
    - Index on to_email for quick lookups
    - Index on sent_at for time-based queries
    - Index on status for filtering
*/

-- Create email_delivery_log table
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('invitation', 'alert', 'password_reset', 'weekly_summary', 'other')),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'simulated')) DEFAULT 'sent',
  resend_id text,
  error_message text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_to_email ON email_delivery_log(to_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_sent_at ON email_delivery_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_status ON email_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_email_type ON email_delivery_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_sent_by ON email_delivery_log(sent_by);

-- Enable RLS
ALTER TABLE email_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all email logs
CREATE POLICY "Admins can view all email logs"
  ON email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Staff can view logs for emails sent to their team members
CREATE POLICY "Staff can view team email logs"
  ON email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'staff'
      AND EXISTS (
        SELECT 1 FROM users AS recipient
        JOIN team_members tm ON tm.user_id = recipient.id
        WHERE recipient.email = email_delivery_log.to_email
        AND tm.team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can view their own email logs
CREATE POLICY "Users can view own email logs"
  ON email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    to_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Policy: Authenticated users can insert email logs (for Edge Function)
CREATE POLICY "Authenticated users can insert email logs"
  ON email_delivery_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
