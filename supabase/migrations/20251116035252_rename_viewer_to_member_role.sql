/*
  # Rename 'viewer' role to 'member' in organization_members

  ## Summary
  This migration renames the organization member role from 'viewer' to 'member' for better clarity.
  
  ## Changes
  1. **Role Renaming**
     - Drop the old CHECK constraint first
     - Update existing 'viewer' records to 'member'
     - Create new CHECK constraint with 'member' role
  
  ## Rationale
  - 'viewer' implies read-only access, which is misleading
  - 'member' better represents regular organization members (coaches and athletes)
  - 'organization_admin' represents management-level staff (supervisors, GMs, head coaches)
  
  ## Migration Steps
  1. Drop the old role constraint
  2. Update all existing 'viewer' roles to 'member'
  3. Create new constraint with 'member' role
  
  ## Security
  - No RLS policy changes needed
  - Maintains all existing permissions
*/

-- Step 1: Drop the old constraint first
ALTER TABLE organization_members 
DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Step 2: Update all existing 'viewer' roles to 'member'
UPDATE organization_members 
SET role = 'member' 
WHERE role = 'viewer';

-- Step 3: Create new constraint with 'member' role
ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('organization_admin', 'member'));