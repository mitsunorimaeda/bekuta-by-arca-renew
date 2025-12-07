import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Starting user sync from auth.users to public.users\n');

async function syncUsers() {
  try {
    // Get all auth users
    console.log('📋 Fetching auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`✅ Found ${authUsers.users.length} auth users\n`);

    // Get first team for default assignment
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .limit(1);

    if (teamError) {
      console.error('❌ Error fetching teams:', teamError);
      return;
    }

    const defaultTeamId = teams && teams.length > 0 ? teams[0].id : null;
    console.log(`📌 Default team ID: ${defaultTeamId}\n`);

    // Sync each user
    let synced = 0;
    let failed = 0;

    for (const authUser of authUsers.users) {
      const metadata = authUser.user_metadata || {};
      const name = metadata.name || authUser.email.split('@')[0];
      const role = metadata.role || 'athlete';
      const teamId = metadata.team_id || defaultTeamId;

      console.log(`Processing: ${authUser.email} (role: ${role})`);

      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          name: name,
          email: authUser.email,
          role: role,
          team_id: teamId
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.log(`  ❌ Failed: ${upsertError.message}`);
        failed++;
      } else {
        console.log(`  ✅ Synced`);
        synced++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Synced: ${synced} users`);
    console.log(`❌ Failed: ${failed} users`);

    // Show final user list
    console.log(`\n📋 Final user list in public.users:`);
    const { data: publicUsers, error: listError } = await supabase
      .from('users')
      .select('id, email, role, name')
      .order('role', { ascending: false });

    if (listError) {
      console.error('❌ Error listing users:', listError);
    } else if (publicUsers) {
      publicUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ${user.name}`);
      });
    }

    // Check for admin users specifically
    const admins = publicUsers?.filter(u => u.role === 'admin') || [];
    if (admins.length === 0) {
      console.log('\n⚠️  WARNING: No admin users found!');
      console.log('   You may need to manually set a user as admin:');
      console.log('   UPDATE users SET role = \'admin\' WHERE email = \'your@email.com\';');
    } else {
      console.log(`\n✅ Found ${admins.length} admin user(s)`);
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

syncUsers();
