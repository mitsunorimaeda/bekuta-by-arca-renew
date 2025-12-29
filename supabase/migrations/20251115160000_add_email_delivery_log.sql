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

/*
  email_delivery_log (idempotent migration)
  - Uses public.users + staff_team_links
*/

-- Create table
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('invitation', 'alert', 'password_reset', 'weekly_summary', 'other')),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'simulated')) DEFAULT 'sent',
  resend_id text,
  error_message text,

  -- ✅ sent_by は public.users を参照（アプリ側のユーザー）
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,

  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_to_email
  ON public.email_delivery_log(to_email);

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_sent_at
  ON public.email_delivery_log(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_status
  ON public.email_delivery_log(status);

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_email_type
  ON public.email_delivery_log(email_type);

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_sent_by
  ON public.email_delivery_log(sent_by);

-- RLS
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- Policies (DROP -> CREATE)
-- -------------------------

-- Admin can view all
DROP POLICY IF EXISTS "Admins can view all email logs" ON public.email_delivery_log;
CREATE POLICY "Admins can view all email logs"
  ON public.email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );

-- Staff can view logs for their team members (users.team_id in staff_team_links)
DROP POLICY IF EXISTS "Staff can view team email logs" ON public.email_delivery_log;
CREATE POLICY "Staff can view team email logs"
  ON public.email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users staff
      WHERE staff.id = auth.uid()
        AND staff.role = 'staff'
    )
    AND EXISTS (
      SELECT 1
      FROM public.users recipient
      JOIN public.staff_team_links stl
        ON stl.team_id = recipient.team_id
      WHERE stl.staff_user_id = auth.uid()
        AND recipient.email = public.email_delivery_log.to_email
    )
  );

-- Users can view own logs (to_email matches their profile email)
DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_delivery_log;
CREATE POLICY "Users can view own email logs"
  ON public.email_delivery_log
  FOR SELECT
  TO authenticated
  USING (
    public.email_delivery_log.to_email = (
      SELECT u.email FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- Insert policy (Edge Functions / server-side logging)
-- ✅ ここは基本「authenticated なら insert可」にしておく（運用は sent_by を service roleで入れる）
DROP POLICY IF EXISTS "Authenticated users can insert email logs" ON public.email_delivery_log;
CREATE POLICY "Authenticated users can insert email logs"
  ON public.email_delivery_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);