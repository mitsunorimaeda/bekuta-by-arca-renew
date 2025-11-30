import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables manually
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
    process.env[key] = value;
  }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword(email, newPassword) {
  try {
    console.log(`\n🔍 Finding user: ${email}`);

    // List all users and find by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('Available users:', users.map(u => u.email));
      return;
    }

    console.log(`✓ User found: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);

    // Update password
    console.log('\n🔄 Resetting password...');
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          requires_password_change: true
        },
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return;
    }

    console.log('✅ Password reset successfully!');
    console.log('   User ID:', updateData.user.id);
    console.log('   Email:', updateData.user.email);
    console.log('   Requires password change:', updateData.user.user_metadata?.requires_password_change);

    // Verify in database
    console.log('\n🔍 Verifying in database...');
    const { data: authUser, error: verifyError } = await supabase
      .from('auth.users')
      .select('id, email, encrypted_password, raw_user_meta_data')
      .eq('email', email)
      .single();

    if (!verifyError && authUser) {
      console.log('✓ Database verification successful');
      console.log('   Has password:', !!authUser.encrypted_password);
      console.log('   Metadata:', authUser.raw_user_meta_data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
const email = process.argv[2] || 'info@arca.fit';
const password = process.argv[3] || 'MNrh8181614';

console.log('🚀 Password Reset Script');
console.log('=======================');
console.log(`Email: ${email}`);
console.log(`New Password: ${password}`);

resetPassword(email, password).then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
