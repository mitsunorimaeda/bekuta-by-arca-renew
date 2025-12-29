/*
  # Remove Departments and Consolidate to Teams

  ## Purpose
  Simplify the organization structure by removing the department layer and
  consolidating functionality directly into teams. Organizations will now
  directly contain teams, creating a simpler 2-tier hierarchy.

  ## Changes Overview

  ### Tables
  1. **teams** - Enhanced to be organization's primary organizational unit
     - Add `description` (text) - Team description
     - Add `settings` (jsonb) - Flexible settings storage
     - Remove `department_id` - No longer needed
     - Keep `organization_id` - Direct link to organization

  2. **departments** - DELETED
     - All data will be removed
     - All foreign key references will be cleaned up

  3. **department_managers** - DELETED
     - No longer needed (coaches use staff_team_links)

  4. **organization_members** - Updated
     - Role 'department_manager' removed from CHECK constraint
     - Only 'organization_admin' and 'viewer' remain

  ### Functions
  - DROP `safe_delete_department()` - No longer needed
  - DROP `validate_team_org_dept_consistency()` - No longer needed
  - UPDATE `get_organization_hierarchy()` - Remove departments from structure
  - UPDATE `get_user_organizations()` - Remove department_count
  - UPDATE `check_orphaned_records()` - Remove department checks

  ### Views
  - UPDATE `organization_stats` - Remove department_count

  ### Triggers
  - DROP department update triggers
  - DROP team organization-department validation trigger

  ### RLS Policies
  - DROP all policies on departments table
  - DROP all policies on department_managers table
  - ADD policies for organization admins to manage teams

  ## Security

  ### New RLS Policies for Teams
  - Organization admins can create, update, and delete teams in their organization
  - Staff members can view teams they have access to
  - Athletes can view their assigned team

  ## Migration Safety

  This migration is designed to be safe and idempotent:
  - Uses IF EXISTS for all DROP statements
  - Uses IF NOT EXISTS for all CREATE statements
  - Preserves existing team data
  - Only removes department-related data (which is confirmed to be disposable)

  ## Rollback Instructions

  If rollback is needed, you would need to:
  1. Restore the departments table structure
  2. Restore department_managers table
  3. Re-add department_id to teams
  4. Restore all related functions, views, and policies

  Note: Since department data is being deleted, a rollback would require
  restoring from a backup if the data needs to be recovered.
*/

-- ============================================================================
-- STEP 1: Drop dependent objects first (functions, triggers, policies)
-- ============================================================================

/*
  # Remove Departments and Consolidate to Teams (SAFE / IDEMPOTENT)

  - departments / department_managers を廃止し、organizations -> teams の2階層に統合
  - ローカル supabase db reset で落ちないように、存在確認 + policy衝突回避を徹底
*/

-- =============================================================================
-- STEP 0: Preflight (schema固定)
-- =============================================================================
SET search_path = public;

-- =============================================================================
-- STEP 1: Drop dependent objects first (functions, triggers, policies)
-- =============================================================================

/*
  # Remove Departments and Consolidate to Teams (SAFE / IDEMPOTENT)

  - departments / department_managers を廃止し、organizations -> teams の2階層に統合
  - supabase db reset / start で落ちないように、存在確認 + policy衝突回避を徹底
*/

-- =============================================================================
-- STEP 0: Preflight
-- =============================================================================
SET search_path = public;

-- =============================================================================
-- STEP 1: Drop dependent objects first (functions, triggers, policies)
-- =============================================================================

-- Functions that may reference departments
DROP FUNCTION IF EXISTS public.safe_delete_department(uuid);
DROP FUNCTION IF EXISTS public.validate_team_org_dept_consistency() CASCADE;

-- Triggers (safe)
DROP TRIGGER IF EXISTS trigger_validate_team_organization_department ON public.teams;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='departments'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_update_department_timestamp ON public.departments;
  END IF;
END $$;

-- Policies on departments (guarded)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='departments'
  ) THEN
    DROP POLICY IF EXISTS "Users can view departments in their organizations" ON public.departments;
    DROP POLICY IF EXISTS "Organization admins can manage departments" ON public.departments;
  END IF;
END $$;

-- Policies on department_managers (guarded)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='department_managers'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their department manager assignments" ON public.department_managers;
    DROP POLICY IF EXISTS "Organization admins can manage department managers" ON public.department_managers;
  END IF;
END $$;

-- =============================================================================
-- STEP 2: Modify teams table structure
-- =============================================================================

-- Add columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='description'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN description text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='settings'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Remove department_id from teams (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='department_id'
  ) THEN
    ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_department_id_fkey;
    ALTER TABLE public.teams DROP COLUMN department_id;
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Drop department-related tables
-- =============================================================================

DROP TABLE IF EXISTS public.department_managers CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

DROP INDEX IF EXISTS public.idx_teams_department_id;

-- =============================================================================
-- STEP 4: Update organization_members role constraint (remove department_manager)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organization_members'
  ) THEN
    ALTER TABLE public.organization_members
      DROP CONSTRAINT IF EXISTS organization_members_role_check;

    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_role_check
      CHECK (role IN ('organization_admin', 'viewer'));
  END IF;
END $$;

-- =============================================================================
-- STEP 5: Recreate / update functions (no departments)
-- =============================================================================

-- get_organization_hierarchy: departmentsなし版に作り替え
DROP FUNCTION IF EXISTS public.get_organization_hierarchy(uuid) CASCADE;

CREATE FUNCTION public.get_organization_hierarchy(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  org_data jsonb;
  teams_data jsonb;
  member_count_val bigint;
BEGIN
  SELECT to_jsonb(o.*) INTO org_data
  FROM public.organizations o
  WHERE o.id = org_id;

  IF org_data IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'settings', t.settings,
      'created_at', t.created_at
    ) ORDER BY t.name
  ), '[]'::jsonb) INTO teams_data
  FROM public.teams t
  WHERE t.organization_id = org_id;

  SELECT COUNT(*) INTO member_count_val
  FROM public.organization_members
  WHERE organization_id = org_id;

  result := org_data || jsonb_build_object(
    'teams', teams_data,
    'member_count', member_count_val
  );

  RETURN result;
END;
$$;

-- get_user_organizations: RETURN型変更があり得るので DROP -> CREATE
DROP FUNCTION IF EXISTS public.get_user_organizations(uuid) CASCADE;

CREATE FUNCTION public.get_user_organizations(user_uuid uuid)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  user_role text,
  member_count bigint,
  team_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM public.teams WHERE organization_id = o.id)
  FROM public.organizations o
  JOIN public.organization_members om ON o.id = om.organization_id
  WHERE om.user_id = user_uuid
  ORDER BY o.name;
END;
$$;

DROP FUNCTION IF EXISTS public.check_orphaned_records() CASCADE;

CREATE OR REPLACE FUNCTION public.check_orphaned_records()
RETURNS TABLE (
  record_type text,
  record_id uuid,
  issue text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- teams without organizations
  RETURN QUERY
  SELECT
    'team'::text,
    t.id,
    'Team has no organization assigned'::text
  FROM public.teams t
  WHERE t.organization_id IS NULL;

  -- organization_members without organizations
  RETURN QUERY
  SELECT
    'organization_member'::text,
    om.id,
    'Organization member references non-existent organization'::text
  FROM public.organization_members om
  LEFT JOIN public.organizations o ON om.organization_id = o.id
  WHERE o.id IS NULL;

  -- organization_members without users
  RETURN QUERY
  SELECT
    'organization_member'::text,
    om.id,
    'Organization member references non-existent user'::text
  FROM public.organization_members om
  LEFT JOIN public.users u ON om.user_id = u.id
  WHERE u.id IS NULL;

  RETURN;
END;
$$;

-- =============================================================================
-- STEP 6: Recreate organization_stats view (no departments)
-- =============================================================================

DROP VIEW IF EXISTS public.organization_stats;

CREATE VIEW public.organization_stats AS
SELECT
  o.id,
  o.name,
  o.description,
  o.created_at,
  o.updated_at,
  COALESCE(t.team_count, 0) AS team_count,
  COALESCE(m.member_count, 0) AS member_count,
  COALESCE(a.admin_count, 0) AS admin_count
FROM public.organizations o
LEFT JOIN (
  SELECT organization_id, COUNT(*) as team_count
  FROM public.teams
  GROUP BY organization_id
) t ON o.id = t.organization_id
LEFT JOIN (
  SELECT organization_id, COUNT(*) as member_count
  FROM public.organization_members
  GROUP BY organization_id
) m ON o.id = m.organization_id
LEFT JOIN (
  SELECT organization_id, COUNT(*) as admin_count
  FROM public.organization_members
  WHERE role = 'organization_admin'
  GROUP BY organization_id
) a ON o.id = a.organization_id;

-- =============================================================================
-- STEP 7: Teams RLS policies (RESET & RECREATE to avoid collisions)
-- =============================================================================

-- teams の既存policyを全削除（policynameが正しい列名）
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teams'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams;', p.policyname);
  END LOOP;
END $$;

-- SELECT: athlete/staff/org members/admin が必要な範囲の teams を見れる
CREATE POLICY "Teams select: athlete/staff/org/admin"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    -- Global admin (users.role='admin') は全部
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- organization member は所属orgのteams
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = public.teams.organization_id
      AND om.role IN ('organization_admin', 'viewer')
    )
    OR
    -- staff は staff_team_links で許可された team
    EXISTS (
      SELECT 1 FROM public.staff_team_links stl
      WHERE stl.staff_user_id = auth.uid()
      AND stl.team_id = public.teams.id
    )
    OR
    -- athlete は自分の users.team_id の team
    EXISTS (
      SELECT 1 FROM public.users a
      WHERE a.id = auth.uid()
      AND a.team_id = public.teams.id
    )
  );

-- INSERT: organization_admin / admin のみ
CREATE POLICY "Teams insert: org_admin/admin"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = public.teams.organization_id
      AND om.role = 'organization_admin'
    )
  );

-- UPDATE: organization_admin / admin のみ
CREATE POLICY "Teams update: org_admin/admin"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = public.teams.organization_id
      AND om.role = 'organization_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = public.teams.organization_id
      AND om.role = 'organization_admin'
    )
  );

-- DELETE: organization_admin / admin のみ
CREATE POLICY "Teams delete: org_admin/admin"
  ON public.teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = public.teams.organization_id
      AND om.role = 'organization_admin'
    )
  );

-- =============================================================================
-- STEP 8: Helper function (org admin view)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_teams(org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  settings jsonb,
  organization_id uuid,
  created_at timestamptz,
  member_count bigint,
  staff_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.settings,
    t.organization_id,
    t.created_at,
    COUNT(DISTINCT u.id) as member_count,
    COUNT(DISTINCT stl.staff_user_id) as staff_count
  FROM public.teams t
  LEFT JOIN public.users u
    ON u.team_id = t.id AND u.role = 'athlete'
  LEFT JOIN public.staff_team_links stl
    ON stl.team_id = t.id
  WHERE t.organization_id = org_id
  GROUP BY t.id, t.name, t.description, t.settings, t.organization_id, t.created_at
  ORDER BY t.name;
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully (SAFE).';
  RAISE NOTICE 'Departments removed; teams now directly belong to organizations.';
  RAISE NOTICE 'Teams RLS policies were reset & recreated to avoid collisions.';
END $$;