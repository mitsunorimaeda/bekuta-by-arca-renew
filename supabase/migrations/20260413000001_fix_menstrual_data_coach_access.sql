-- Fix: Make menstrual/cycle data sharing with coaches opt-in
-- Previously coaches could view all team athletes' menstrual data by default
-- Now athletes must explicitly opt-in to share

-- Add opt-in field to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS share_cycle_data_with_coaches boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.share_cycle_data_with_coaches IS
  'Athlete opt-in: when true, coaches in the same team can view menstrual cycle data. Default false for privacy protection.';

-- ----------------------------------------------------------------
-- menstrual_cycles
-- ----------------------------------------------------------------
-- Drop the automatic coach access policy (actual policy name from DB)
DROP POLICY IF EXISTS "Staff can view team menstrual cycles" ON public.menstrual_cycles;
-- Also drop the original migration policy name in case it exists
DROP POLICY IF EXISTS "Coaches can view team menstrual cycles" ON public.menstrual_cycles;

-- Re-create with opt-in check
CREATE POLICY "Coaches can view shared menstrual cycles"
ON public.menstrual_cycles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users athlete
    JOIN public.staff_team_links stl ON stl.team_id = athlete.team_id
    WHERE athlete.id = menstrual_cycles.user_id
      AND stl.staff_user_id = auth.uid()
      AND athlete.share_cycle_data_with_coaches = true
  )
);

-- ----------------------------------------------------------------
-- basal_body_temperature
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches can view team basal body temperature" ON public.basal_body_temperature;

CREATE POLICY "Coaches can view shared basal body temperature"
ON public.basal_body_temperature
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users athlete
    JOIN public.staff_team_links stl ON stl.team_id = athlete.team_id
    WHERE athlete.id = basal_body_temperature.user_id
      AND stl.staff_user_id = auth.uid()
      AND athlete.share_cycle_data_with_coaches = true
  )
);

-- ----------------------------------------------------------------
-- menstrual_daily_logs
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches can view team daily logs" ON public.menstrual_daily_logs;

CREATE POLICY "Coaches can view shared menstrual daily logs"
ON public.menstrual_daily_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users athlete
    JOIN public.staff_team_links stl ON stl.team_id = athlete.team_id
    WHERE athlete.id = menstrual_daily_logs.user_id
      AND stl.staff_user_id = auth.uid()
      AND athlete.share_cycle_data_with_coaches = true
  )
);
