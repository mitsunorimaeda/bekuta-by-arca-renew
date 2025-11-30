/*
  # Fix reject_team_access_request Function

  ## Issue
  The reject_team_access_request function has a bug on line 287:
  `reviewed_at = reviewed_at` should be `reviewed_at = now()`

  ## Changes
  - Update the reject_team_access_request function to correctly set reviewed_at to now()
*/

CREATE OR REPLACE FUNCTION reject_team_access_request(
  request_id uuid,
  reviewer_user_id uuid,
  notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  -- Get request status
  SELECT status INTO v_status
  FROM team_access_requests
  WHERE id = request_id;

  -- Check if request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Request has already been reviewed';
  END IF;

  -- Update request status
  UPDATE team_access_requests
  SET 
    status = 'rejected',
    reviewed_by = reviewer_user_id,
    reviewed_at = now(),  -- Fixed: was "reviewed_at = reviewed_at"
    review_notes = notes,
    updated_at = now()
  WHERE id = request_id;
END;
$$;
