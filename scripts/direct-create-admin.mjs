import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables!');
  console.error('Please ensure .env file exists with:');
  console.error('  VITE_SUPABASE_URL');
  console.error('  VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'info@arca.fit';
const password = 'Admin2024!';
const name = 'Administrator';

console.log('🔧 Attempting to sign up admin user...');
console.log('Email:', email);
console.log('Password:', password);
console.log('');

try {
  // First, try to sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        name: name,
        role: 'admin'
      }
    }
  });

  if (signUpError) {
    console.error('❌ Sign up error:', signUpError.message);

    // If user already exists, that's okay
    if (signUpError.message.includes('already registered')) {
      console.log('ℹ️  User already exists, trying to update profile...');

      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (signInError) {
        console.error('❌ Cannot sign in:', signInError.message);
        console.log('\n⚠️  Please reset password in Supabase Dashboard');
        process.exit(1);
      }

      console.log('✅ Signed in successfully');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }

  if (signUpData.user) {
    console.log('✅ User created in auth.users:', signUpData.user.id);

    // Now create the profile in public.users
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: signUpData.user.id,
        name: name,
        email: email,
        role: 'admin',
        team_id: null
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile creation error:', profileError.message);
      console.log('\nYou may need to manually add the user to public.users table');
      console.log('User ID:', signUpData.user.id);
    } else {
      console.log('✅ Profile created:', profileData.user_id);
    }

    console.log('\n🎉 Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    console.error('❌ No user data returned');
  }

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}
