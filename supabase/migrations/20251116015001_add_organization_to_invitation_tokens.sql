/*
  # Add Organization ID to Invitation Tokens

  ## Overview
  Enhances the invitation system to include organization membership during user invitation.
  This allows new users to be automatically assigned to both an organization and a team.

  ## Changes

  ### Table Modifications
  1. **invitation_tokens**
     - Add `organization_id` (uuid, nullable, foreign key to organizations)
     - Add index on organization_id for query performance

  ### Data Integrity
  - Foreign key constraint ensures organization_id references valid organizations
  - ON DELETE SET NULL ensures tokens remain valid even if organization is deleted

  ## Migration Safety
  - Uses IF NOT EXISTS to make migration idempotent
  - Nullable column allows backward compatibility with existing tokens
  - No data loss as existing records will have NULL organization_id

  ## Security
  - Existing RLS policies remain in effect
  - No changes to access control needed
*/

-- Add organization_id column to invitation_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitation_tokens' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE invitation_tokens 
    ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_invitation_tokens_organization_id 
    ON invitation_tokens(organization_id);
    
    RAISE NOTICE 'Added organization_id column to invitation_tokens table';
  ELSE
    RAISE NOTICE 'organization_id column already exists in invitation_tokens table';
  END IF;
END $$;
