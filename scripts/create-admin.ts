import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  const email = 'info@arca.fit';
  const password = 'Admin2024!';
  const name = 'Administrator';
  const role = 'admin';

  console.log('🔧 Creating admin user...');
  console.log('Email:', email);

  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role,
        requires_password_change: false
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      process.exit(1);
    }

    if (!authUser.user) {
      console.error('❌ No user created');
      process.exit(1);
    }

    console.log('✅ Auth user created:', authUser.user.id);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        name: name,
        email: email,
        role: role,
        team_id: null
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      process.exit(1);
    }

    console.log('✅ Profile created:', profile.user_id);
    console.log('\n🎉 Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  Please change this password after first login\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAdminUser();
