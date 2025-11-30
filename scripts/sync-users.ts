import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncUsers() {
  try {
    console.log('Starting user sync...');

    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    console.log(`Found ${authUsers.users.length} auth users`);

    // Ensure at least one team exists
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id')
      .limit(1);

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return;
    }

    let defaultTeamId = teams?.[0]?.id;

    if (!defaultTeamId) {
      console.log('Creating default team...');
      const { data: newTeam, error: teamCreateError } = await supabase
        .from('teams')
        .insert({ name: 'デフォルトチーム' })
        .select()
        .single();

      if (teamCreateError) {
        console.error('Error creating default team:', teamCreateError);
        return;
      }
      defaultTeamId = newTeam.id;
    }

    // Sync each user
    let successCount = 0;
    let errorCount = 0;

    for (const authUser of authUsers.users) {
      const userName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown';
      const userRole = authUser.user_metadata?.role || 'athlete';
      const userTeamId = authUser.user_metadata?.team_id || defaultTeamId;

      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          name: userName,
          email: authUser.email!,
          role: userRole,
          team_id: userTeamId
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error(`Error syncing user ${authUser.email}:`, upsertError);
        errorCount++;
      } else {
        console.log(`✓ Synced user: ${authUser.email}`);
        successCount++;
      }
    }

    console.log(`\nSync complete!`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    // Verify sync
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log(`\nTotal users in public.users: ${count}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

syncUsers();
