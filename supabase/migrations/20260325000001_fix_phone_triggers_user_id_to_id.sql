-- Fix: Multiple phone-related trigger functions were referencing new.user_id (TEXT "USER0001")
-- instead of new.id (UUID), causing type mismatch errors when athletes try to save
-- their profile with a phone number.
--
-- Affected functions:
--   1. trg_link_inbody_on_phone_change() - called link_inbody_records_by_phone(new.user_id)
--   2. link_inbody_records_by_phone(uuid) - did WHERE user_id = p_user_id (TEXT vs UUID)
--   3. link_inbody_by_phone() - did SET user_id = new.user_id (TEXT into UUID column)

-- 1) Fix trg_link_inbody_on_phone_change: new.user_id → new.id
CREATE OR REPLACE FUNCTION trg_link_inbody_on_phone_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.phone_number IS NOT NULL)
     AND (COALESCE(NEW.phone_number, '') <> COALESCE(OLD.phone_number, '')) THEN
    PERFORM public.link_inbody_records_by_phone(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Fix link_inbody_records_by_phone(uuid): WHERE user_id → WHERE id
CREATE OR REPLACE FUNCTION link_inbody_records_by_phone(p_user_id uuid DEFAULT auth.uid())
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_phone text;
  v_norm  text;
  v_count int := 0;
BEGIN
  SELECT phone_number
    INTO v_phone
  FROM public.users
  WHERE id = p_user_id;

  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'no phone_number on users');
  END IF;

  v_norm := public.normalize_phone(v_phone);

  IF v_norm IS NULL OR length(trim(v_norm)) = 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'normalize_phone failed');
  END IF;

  UPDATE public.inbody_records
     SET user_id = p_user_id,
         updated_at = now()
   WHERE user_id IS NULL
     AND phone_number_norm = v_norm;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('ok', true, 'linked', v_count, 'phone_norm', v_norm);
END;
$$;

-- 3) Fix link_inbody_by_phone: SET user_id = new.user_id → new.id
CREATE OR REPLACE FUNCTION link_inbody_by_phone()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.phone_number IS NULL
     AND NEW.phone_number IS NOT NULL
     AND NEW.id IS NOT NULL THEN

    UPDATE public.inbody_records
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND phone_number_norm = normalize_phone(NEW.phone_number);
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Recreate trg_users_phone_link_inbody to ensure it uses new.id
CREATE OR REPLACE FUNCTION trg_users_phone_link_inbody()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.phone_number IS DISTINCT FROM OLD.phone_number) THEN
    PERFORM public.link_inbody_records_by_phone(NEW.id, NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;
