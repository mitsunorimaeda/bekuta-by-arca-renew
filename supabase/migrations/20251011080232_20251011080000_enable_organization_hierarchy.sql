/*
  # Enable Organization Hierarchy Tables

  ## Purpose
  Create a comprehensive organization hierarchy structure to support multi-level organization management.
  This migration creates the organization hierarchy tables that support:
  - Multiple organizations
  - Departments within organizations
  - Organization membership and roles
  - Department managers

  ## New Tables

  ### `organizations`
  Top-level organization entities
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, unique, not null) - Organization name
  - `description` (text, default '') - Organization description
  - `settings` (jsonb, default {}) - Flexible settings storage
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `departments`
  Departments within organizations
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, not null, fk -> organizations.id) - Parent organization
  - `name` (text, not null) - Department name (unique within organization)
  - `description` (text, default '') - Department description
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp
  - UNIQUE constraint on (organization_id, name)

  ### `organization_members`
  Links users to organizations with roles
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null, fk -> users.id) - Member user
  - `organization_id` (uuid, not null, fk -> organizations.id) - Organization
  - `role` (text, not null) - Role: 'organization_admin', 'department_manager', 'viewer'
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - UNIQUE constraint on (user_id, organization_id)
  - CHECK constraint on role values

  ### `department_managers`
  Links users as managers of specific departments
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null, fk -> users.id) - Manager user
  - `department_id` (uuid, not null, fk -> departments.id) - Managed department
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - UNIQUE constraint on (user_id, department_id)

  ## Updates to Existing Tables

  ### `teams`
  - Add `organization_id` (uuid, nullable, fk -> organizations.id)
  - Add `department_id` (uuid, nullable, fk -> departments.id)

  ## Security

  ### RLS Policies

  #### organizations
  - Admins can view all organizations
  - Admins can manage organizations (insert, update, delete)
  - Organization members can view their organizations

  #### departments
  - Users can view departments in their organizations
  - Organization admins can manage departments
  - Admins can manage all departments

  #### organization_members
  - Users can view their organization memberships
  - Organization admins can manage memberships in their organizations
  - Admins can manage all memberships

  #### department_managers
  - Users can view their department manager assignments
  - Organization admins can manage department managers in their organization
  - Admins can manage all department managers

  ## Indexes
  
  Performance indexes on foreign key columns:
  - `idx_departments_organization_id` on departments(organization_id)
  - `idx_organization_members_user_id` on organization_members(user_id)
  - `idx_organization_members_organization_id` on organization_members(organization_id)
  - `idx_department_managers_user_id` on department_managers(user_id)
  - `idx_department_managers_department_id` on department_managers(department_id)
  - `idx_teams_organization_id` on teams(organization_id)
  - `idx_teams_department_id` on teams(department_id)

  ## Data Integrity

  ### Foreign Key Actions
  - All foreign keys use ON DELETE CASCADE to maintain referential integrity
  - When an organization is deleted, all departments, members, and associated data are removed
  - When a department is deleted, all department managers are removed
  - When a user is deleted, all organization memberships and department manager assignments are removed

  ### Constraints
  - Organization names must be globally unique
  - Department names must be unique within each organization
  - Users can only have one membership per organization
  - Users can only be assigned as manager of a department once

  ## Important Notes

  1. **Cascading Deletes**: Deleting an organization will cascade delete all related:
     - Departments
     - Organization members
     - Teams (organization_id will be set to NULL if not using CASCADE)

  2. **Role Validation**: The role field in organization_members is constrained to specific values

  3. **Idempotent Design**: All CREATE statements use IF NOT EXISTS for safe re-execution
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('organization_admin', 'department_manager', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Create department_managers table
CREATE TABLE IF NOT EXISTS department_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Add organization and department references to teams table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Admins can view all organizations'
  ) THEN
    CREATE POLICY "Admins can view all organizations"
      ON organizations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Admins can manage organizations'
  ) THEN
    CREATE POLICY "Admins can manage organizations"
      ON organizations FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Organization members can view their organizations'
  ) THEN
    CREATE POLICY "Organization members can view their organizations"
      ON organizations FOR SELECT
      TO authenticated
      USING (
        id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS Policies for departments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Users can view departments in their organizations'
  ) THEN
    CREATE POLICY "Users can view departments in their organizations"
      ON departments FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Organization admins can manage departments'
  ) THEN
    CREATE POLICY "Organization admins can manage departments"
      ON departments FOR ALL
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role = 'organization_admin'
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- RLS Policies for organization_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Users can view their organization memberships'
  ) THEN
    CREATE POLICY "Users can view their organization memberships"
      ON organization_members FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role = 'organization_admin'
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Organization admins can manage memberships'
  ) THEN
    CREATE POLICY "Organization admins can manage memberships"
      ON organization_members FOR ALL
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role = 'organization_admin'
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- RLS Policies for department_managers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'department_managers' AND policyname = 'Users can view their department manager assignments'
  ) THEN
    CREATE POLICY "Users can view their department manager assignments"
      ON department_managers FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR department_id IN (
          SELECT d.id FROM departments d
          JOIN organization_members om ON d.organization_id = om.organization_id
          WHERE om.user_id = auth.uid() AND om.role = 'organization_admin'
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'department_managers' AND policyname = 'Organization admins can manage department managers'
  ) THEN
    CREATE POLICY "Organization admins can manage department managers"
      ON department_managers FOR ALL
      TO authenticated
      USING (
        department_id IN (
          SELECT d.id FROM departments d
          JOIN organization_members om ON d.organization_id = om.organization_id
          WHERE om.user_id = auth.uid() AND om.role = 'organization_admin'
        )
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_department_managers_user_id ON department_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_department_managers_department_id ON department_managers(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_department_id ON teams(department_id);