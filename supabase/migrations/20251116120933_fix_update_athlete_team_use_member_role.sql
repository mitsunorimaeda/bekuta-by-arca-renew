/*
  # Fix update_athlete_team to Use 'member' Role

  ## Problem
  The update_athlete_team function uses 'viewer' role when adding athletes to organization_members,
  but the organization_members table constraint only allows 'organization_admin' and 'member' roles.

  ## Solution
  Update the function to use 'member' instead of 'viewer'.

  ## Changes
  - Drop and recreate update_athlete_team function
  - Change 'viewer' to 'member' in the INSERT statement
*/

-- Drop and recreate the function with the correct role
DROP FUNCTION IF EXISTS update_athlete_team(uuid, uuid);

CREATE OR REPLACE FUNCTION update_athlete_team(
  athlete_id uuid,
  new_team_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id uuid;
  v_old_team_id uuid;
BEGIN
  -- Get the athlete's current team
  SELECT team_id INTO v_old_team_id
  FROM users
  WHERE id = athlete_id AND role = 'athlete';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Athlete not found or user is not an athlete';
  END IF;
  
  -- If new_team_id is provided, get the organization_id from the team
  IF new_team_id IS NOT NULL THEN
    SELECT organization_id INTO v_organization_id
    FROM teams
    WHERE id = new_team_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Team not found';
    END IF;
    
    -- Add to organization_members if not already a member
    -- Use 'member' role as the default for team members
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (athlete_id, v_organization_id, 'member')
    ON CONFLICT (user_id, organization_id) 
    DO NOTHING; -- Already a member, no action needed
  END IF;
  
  -- Update the team_id in users table
  UPDATE users
  SET 
    team_id = new_team_id,
    updated_at = now()
  WHERE id = athlete_id;
  
  -- Note: We do NOT remove from organization_members when removing from team
  -- This allows the athlete to remain an organization member and be reassigned to another team
  
  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_athlete_team(uuid, uuid) TO authenticated;
