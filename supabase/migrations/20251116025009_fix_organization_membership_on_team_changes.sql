/*
  # Fix Organization Membership Management
  
  ## Overview
  チームへの追加/削除時に、organization_membersテーブルも自動的に管理されるようにします。
  
  ## Changes
  
  1. **update_athlete_team関数の更新**
     - チームに追加する時: organization_membersにも自動追加（まだ存在しない場合）
     - チームから削除する時: organization_membersは保持（組織メンバーのまま）
     
  2. **既存データの修正**
     - 現在チームに所属しているが、organization_membersに登録されていない選手を自動追加
     
  ## Security
  - 既存のRLSポリシーを維持
  - SECURITY DEFINER関数でRLSをバイパス
  
  ## Design Decision
  選択肢1を採用:
  - チームに追加 = 自動的に組織メンバーになる（role: viewer）
  - チームから削除 = 組織には残る（別のチームに移動可能）
  - 組織管理者は、チームなしの組織メンバーも管理できる
*/

-- ============================================================================
-- Drop and recreate update_athlete_team function with organization_members management
-- ============================================================================

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
    -- Use 'viewer' role as the default for team members
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (athlete_id, v_organization_id, 'viewer')
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

-- ============================================================================
-- Fix existing data: Add team members to organization_members
-- ============================================================================

-- Add all athletes who are in teams but not in organization_members
INSERT INTO organization_members (user_id, organization_id, role)
SELECT DISTINCT 
  u.id as user_id,
  t.organization_id,
  'viewer' as role
FROM users u
INNER JOIN teams t ON u.team_id = t.id
WHERE u.role = 'athlete'
  AND NOT EXISTS (
    SELECT 1 
    FROM organization_members om 
    WHERE om.user_id = u.id 
      AND om.organization_id = t.organization_id
  )
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Add all staff who are in teams but not in organization_members
INSERT INTO organization_members (user_id, organization_id, role)
SELECT DISTINCT 
  stl.staff_user_id as user_id,
  t.organization_id,
  'viewer' as role
FROM staff_team_links stl
INNER JOIN teams t ON stl.team_id = t.id
WHERE NOT EXISTS (
    SELECT 1 
    FROM organization_members om 
    WHERE om.user_id = stl.staff_user_id 
      AND om.organization_id = t.organization_id
  )
ON CONFLICT (user_id, organization_id) DO NOTHING;
