import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEMP_PASSWORD = 'TempPassword123!';

async function setTempPasswords() {
  try {
    console.log('🔐 Setting temporary passwords for all users...\n');

    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📋 Found ${authUsers.users.length} users\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of authUsers.users) {
      try {
        // Set password
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          user.id,
          {
            password: TEMP_PASSWORD,
            user_metadata: {
              ...user.user_metadata,
              requires_password_change: true
            }
          }
        );

        if (passwordError) {
          console.error(`❌ Error setting password for ${user.email}:`, passwordError);
          errorCount++;
        } else {
          console.log(`✅ ${user.email} - Password set`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Unexpected error for ${user.email}:`, err);
        errorCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n🔑 Temporary Password:', TEMP_PASSWORD);
    console.log('⚠️  All users must change their password on first login\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

setTempPasswords();
