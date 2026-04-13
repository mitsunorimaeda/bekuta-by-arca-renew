-- Implement streak freeze consumption logic
-- When a user misses exactly 1 day and has streak_freeze_count > 0,
-- consume one freeze and maintain the streak

CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id uuid,
  p_streak_type text,
  p_record_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak record;
  v_days_diff integer;
BEGIN
  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = p_user_id AND streak_type = p_streak_type;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, streak_type, current_streak, longest_streak, last_recorded_date, total_records)
    VALUES (p_user_id, p_streak_type, 1, 1, p_record_date, 1);
    RETURN;
  END IF;

  -- Same day: just increment total_records
  IF v_streak.last_recorded_date = p_record_date THEN
    UPDATE public.user_streaks
    SET total_records = total_records + 1,
        updated_at = now()
    WHERE user_id = p_user_id AND streak_type = p_streak_type;
    RETURN;
  END IF;

  -- Calculate days since last record
  v_days_diff := p_record_date - v_streak.last_recorded_date;

  IF v_days_diff = 1 THEN
    -- Consecutive day: extend streak
    UPDATE public.user_streaks
    SET current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_recorded_date = p_record_date,
        total_records = total_records + 1,
        updated_at = now()
    WHERE user_id = p_user_id AND streak_type = p_streak_type;

  ELSIF v_days_diff = 2 AND v_streak.streak_freeze_count > 0 THEN
    -- Missed exactly 1 day but has freeze: consume freeze, maintain streak
    UPDATE public.user_streaks
    SET current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_recorded_date = p_record_date,
        total_records = total_records + 1,
        streak_freeze_count = streak_freeze_count - 1,
        updated_at = now()
    WHERE user_id = p_user_id AND streak_type = p_streak_type;

  ELSE
    -- Streak broken: reset to 1
    UPDATE public.user_streaks
    SET current_streak = 1,
        last_recorded_date = p_record_date,
        total_records = total_records + 1,
        updated_at = now()
    WHERE user_id = p_user_id AND streak_type = p_streak_type;
  END IF;
END;
$$;
