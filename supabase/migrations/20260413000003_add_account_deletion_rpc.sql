-- Account deletion RPC
-- Anonymizes or deletes all personal data for a user
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow users to delete their own account
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Delete personal health/training data (only tables confirmed to exist)
  DELETE FROM public.training_records WHERE user_id = p_user_id;
  DELETE FROM public.menstrual_cycles WHERE user_id = p_user_id;
  DELETE FROM public.basal_body_temperature WHERE user_id = p_user_id;
  DELETE FROM public.menstrual_daily_logs WHERE user_id = p_user_id;
  DELETE FROM public.user_streaks WHERE user_id = p_user_id;
  DELETE FROM public.user_points WHERE user_id = p_user_id;
  DELETE FROM public.user_badges WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;

  -- Anonymize user profile (keep record for audit, remove PII)
  UPDATE public.users
  SET
    name = '削除済みユーザー',
    email = p_user_id::text || '@deleted.invalid',
    is_active = false,
    status = 'deleted'
  WHERE id = p_user_id;

  -- Delete auth user (this will cascade to RLS-protected data)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
