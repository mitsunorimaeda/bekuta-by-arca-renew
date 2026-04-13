-- Schedule push notifications via pg_cron + pg_net
-- Sends time-aware reminders to athletes with incomplete daily records
--
-- Triggers:
--   20:00 JST (11:00 UTC) — training reminder
--   22:00 JST (13:00 UTC) — last-chance reminder for any missing record

-- Enable required extensions (already enabled in most Supabase projects)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedules if re-running migration
SELECT cron.unschedule('bekuta-notify-20:00') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bekuta-notify-20:00'
);
SELECT cron.unschedule('bekuta-notify-22:00') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bekuta-notify-22:00'
);

-- 20:00 JST = 11:00 UTC
SELECT cron.schedule(
  'bekuta-notify-20:00',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/notify-incomplete-records',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body     := '{"trigger":"20:00"}'::jsonb
  );
  $$
);

-- 22:00 JST = 13:00 UTC
SELECT cron.schedule(
  'bekuta-notify-22:00',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/notify-incomplete-records',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body     := '{"trigger":"22:00"}'::jsonb
  );
  $$
);
