/*
  # Data Integrity Protection for Organization Hierarchy

  ## Purpose
  Add comprehensive data integrity protection mechanisms to prevent data corruption,
  orphaned records, and inconsistent states in the organization hierarchy.

  ## New Functions

  ### 1. Timestamp Management
  `update_updated_at_column()` - Automatically updates updated_at timestamp

  ### 2. Validation Functions
  `validate_team_org_dept_consistency()` - Ensures team's organization and department are consistent

  ### 3. Data Integrity Checks
  `check_orphaned_records()` - Detects orphaned or inconsistent records

  ### 4. Hierarchy Retrieval
  `get_organization_hierarchy()` - Returns complete organization structure with departments and teams

  ### 5. Safe Operations
  `safe_delete_department()` - Safely deletes department while handling team assignments

  ### 6. User Access
  `get_user_organizations()` - Returns organizations accessible to a user

  ## Triggers

  - `trigger_update_organization_timestamp` - Updates organizations.updated_at
  - `trigger_update_department_timestamp` - Updates departments.updated_at
  - `trigger_validate_team_organization_department` - Validates team hierarchy consistency

  ## Views

  - `organization_stats` - Statistical overview of organizations
*/

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for organizations updated_at
DROP TRIGGER IF EXISTS trigger_update_organization_timestamp ON organizations;
CREATE TRIGGER trigger_update_organization_timestamp
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for departments updated_at
DROP TRIGGER IF EXISTS trigger_update_department_timestamp ON departments;
CREATE TRIGGER trigger_update_department_timestamp
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate team organization and department consistency
CREATE OR REPLACE FUNCTION validate_team_org_dept_consistency()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  dept_org_id uuid;
BEGIN
  IF NEW.organization_id IS NOT NULL AND NEW.department_id IS NOT NULL THEN
    SELECT organization_id INTO dept_org_id
    FROM departments
    WHERE id = NEW.department_id;
    
    IF dept_org_id IS NULL THEN
      RAISE EXCEPTION 'Department does not exist: %', NEW.department_id;
    END IF;
    
    IF dept_org_id != NEW.organization_id THEN
      RAISE EXCEPTION 'Department % does not belong to organization %', 
        NEW.department_id, NEW.organization_id;
    END IF;
  END IF;
  
  IF NEW.department_id IS NOT NULL AND NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM departments
    WHERE id = NEW.department_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to validate team organization and department consistency
DROP TRIGGER IF EXISTS trigger_validate_team_organization_department ON teams;
CREATE TRIGGER trigger_validate_team_organization_department
  BEFORE INSERT OR UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION validate_team_org_dept_consistency();

-- Function to check for orphaned records
CREATE OR REPLACE FUNCTION check_orphaned_records()
RETURNS TABLE (
  record_type text,
  record_id uuid,
  issue text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'team'::text,
    t.id,
    'Team has organization_id that does not exist'::text
  FROM teams t
  WHERE t.organization_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = t.organization_id);
  
  RETURN QUERY
  SELECT 
    'team'::text,
    t.id,
    'Team has department_id that does not exist'::text
  FROM teams t
  WHERE t.department_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM departments WHERE id = t.department_id);
  
  RETURN QUERY
  SELECT 
    'team'::text,
    t.id,
    'Team organization_id does not match department organization_id'::text
  FROM teams t
  JOIN departments d ON t.department_id = d.id
  WHERE t.organization_id IS NOT NULL
    AND t.department_id IS NOT NULL
    AND t.organization_id != d.organization_id;
  
  RETURN QUERY
  SELECT 
    'organization_member'::text,
    om.id,
    'Organization member references non-existent user'::text
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = om.user_id);
  
  RETURN QUERY
  SELECT 
    'department_manager'::text,
    dm.id,
    'Department manager references non-existent user'::text
  FROM department_managers dm
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = dm.user_id);
END;
$$;

-- Function to get organization hierarchy
CREATE OR REPLACE FUNCTION get_organization_hierarchy(org_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'description', o.description,
    'settings', o.settings,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'departments', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'description', d.description,
          'created_at', d.created_at,
          'updated_at', d.updated_at,
          'teams', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name,
                'created_at', t.created_at
              )
            ), '[]'::jsonb)
            FROM teams t
            WHERE t.department_id = d.id
          )
        )
      ), '[]'::jsonb)
      FROM departments d
      WHERE d.organization_id = o.id
    ),
    'teams_without_department', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'created_at', t.created_at
        )
      ), '[]'::jsonb)
      FROM teams t
      WHERE t.organization_id = o.id AND t.department_id IS NULL
    ),
    'member_count', (
      SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id
    )
  ) INTO result
  FROM organizations o
  WHERE o.id = org_id;
  
  RETURN result;
END;
$$;

-- Function to safely delete department
CREATE OR REPLACE FUNCTION safe_delete_department(dept_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  team_count integer;
  org_id uuid;
  result jsonb;
BEGIN
  SELECT COUNT(*), MAX(d.organization_id)
  INTO team_count, org_id
  FROM teams t
  JOIN departments d ON t.department_id = d.id
  WHERE t.department_id = dept_id;
  
  IF team_count > 0 THEN
    UPDATE teams
    SET department_id = NULL,
        organization_id = org_id
    WHERE department_id = dept_id;
    
    result := jsonb_build_object(
      'success', true,
      'teams_moved', team_count,
      'message', format('%s teams moved to organization level', team_count)
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'teams_moved', 0,
      'message', 'No teams affected'
    );
  END IF;
  
  DELETE FROM department_managers WHERE department_id = dept_id;
  DELETE FROM departments WHERE id = dept_id;
  
  RETURN result;
END;
$$;

-- Function to get user's accessible organizations
CREATE OR REPLACE FUNCTION get_user_organizations(user_uuid uuid)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  user_role text,
  member_count bigint,
  department_count bigint,
  team_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    om.role,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM departments WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM teams WHERE organization_id = o.id)
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = user_uuid
  ORDER BY o.name;
END;
$$;

-- Drop existing view if it exists
DROP VIEW IF EXISTS organization_stats;

-- Create view for organization statistics
CREATE VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  o.description,
  o.created_at,
  o.updated_at,
  (SELECT COUNT(*) FROM departments WHERE organization_id = o.id) as department_count,
  (SELECT COUNT(*) FROM teams WHERE organization_id = o.id) as team_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND role = 'organization_admin') as admin_count
FROM organizations o;

GRANT SELECT ON organization_stats TO authenticated;