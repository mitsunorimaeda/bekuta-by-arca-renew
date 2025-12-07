#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('- VITE_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getOrCreateDefaultOrganization() {
  const { data: existingOrg, error: fetchError } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching organizations:', fetchError);
    throw fetchError;
  }

  if (existingOrg) {
    console.log(`Found existing organization: ${existingOrg.id}`);
    return existingOrg.id;
  }

  console.log('No organizations found. Creating default organization...');

  const { data: newOrg, error: createError } = await supabase
    .from('organizations')
    .insert({
      name: 'デフォルト組織',
      description: '既存チームを移行するための初期組織'
    })
    .select('id')
    .single();

  if (createError) {
    console.error('Error creating organization:', createError);
    throw createError;
  }

  console.log(`✓ Created default organization: ${newOrg.id}`);
  return newOrg.id;
}

async function getTeamsWithoutOrganization() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name')
    .is('organization_id', null);

  if (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }

  return data || [];
}

async function assignTeamToOrganization(teamId, organizationId) {
  const { error } = await supabase
    .from('teams')
    .update({ organization_id: organizationId })
    .eq('id', teamId);

  if (error) {
    console.error(`Error assigning team ${teamId}:`, error);
    throw error;
  }
}

async function addAdminToOrganization(organizationId) {
  const { data: adminUsers, error: adminError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  if (adminError) {
    console.error('Error fetching admin users:', adminError);
    return;
  }

  if (!adminUsers || adminUsers.length === 0) {
    console.log('⚠ No admin users found to add to organization');
    return;
  }

  const adminId = adminUsers[0].id;

  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', adminId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (existingMember) {
    console.log('✓ Admin is already a member of the organization');
    return;
  }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      user_id: adminId,
      organization_id: organizationId,
      role: 'organization_admin'
    });

  if (memberError) {
    console.error('Error adding admin to organization:', memberError);
    return;
  }

  console.log('✓ Added admin user to organization');
}

async function main() {
  console.log('=== Team to Organization Migration ===\n');

  try {
    const organizationId = await getOrCreateDefaultOrganization();

    await addAdminToOrganization(organizationId);

    const teamsWithoutOrg = await getTeamsWithoutOrganization();

    if (teamsWithoutOrg.length === 0) {
      console.log('\n✓ All teams are already assigned to organizations');
      console.log('\nMigration complete!');
      return;
    }

    console.log(`\nFound ${teamsWithoutOrg.length} teams without organization assignment:`);
    teamsWithoutOrg.forEach(team => {
      console.log(`  - ${team.name} (${team.id})`);
    });

    console.log(`\nAssigning teams to organization ${organizationId}...`);

    for (const team of teamsWithoutOrg) {
      await assignTeamToOrganization(team.id, organizationId);
      console.log(`✓ Assigned team: ${team.name}`);
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✓ Organization ID: ${organizationId}`);
    console.log(`✓ Teams migrated: ${teamsWithoutOrg.length}`);
    console.log('\nMigration complete!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
