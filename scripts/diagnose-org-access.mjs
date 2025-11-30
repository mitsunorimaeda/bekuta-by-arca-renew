import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

console.log('🔍 Organization Access Diagnostics\n');
console.log('=' .repeat(60));

async function diagnose() {
  try {
    // Check 1: Get current session
    console.log('\n📋 Step 1: Checking Authentication Session');
    const { data: { session }, error: sessionError } = await supabaseAnon.auth.getSession();

    if (sessionError) {
      console.log('❌ Session Error:', sessionError.message);
    } else if (!session) {
      console.log('⚠️  No active session found');
      console.log('   You need to be logged in to test organization access');
      console.log('\n💡 Checking database state with admin access instead...\n');
    } else {
      console.log('✅ Active session found');
      console.log('   User ID:', session.user.id);
      console.log('   Email:', session.user.email);
    }

    // Check 2: Count organizations (admin access)
    console.log('\n📋 Step 2: Checking Organizations Table');
    const { count: orgCount, error: countError } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Error counting organizations:', countError.message);
    } else {
      console.log(`✅ Organizations table has ${orgCount} record(s)`);
    }

    // Check 3: Get organizations with admin access
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .limit(5);

    if (orgsError) {
      console.log('❌ Error fetching organizations:', orgsError.message);
    } else if (orgs && orgs.length > 0) {
      console.log('\n   Organizations:');
      orgs.forEach(org => {
        console.log(`   - ${org.name} (ID: ${org.id})`);
      });
    } else {
      console.log('⚠️  No organizations found in database');
    }

    // Check 4: Get all users with admin role
    console.log('\n📋 Step 3: Checking Admin Users');
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id, user_id, email, name, role')
      .eq('role', 'admin');

    if (adminError) {
      console.log('❌ Error fetching admin users:', adminError.message);
    } else if (adminUsers && adminUsers.length > 0) {
      console.log(`✅ Found ${adminUsers.length} admin user(s):`);
      adminUsers.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id}, Auth UID: ${user.user_id})`);
      });
    } else {
      console.log('❌ No admin users found!');
    }

    // Check 5: Verify auth.users table
    console.log('\n📋 Step 4: Checking Auth Users');
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.log('❌ Error fetching auth users:', authError.message);
    } else if (authUsers && authUsers.users) {
      console.log(`✅ Found ${authUsers.users.length} auth user(s)`);
      authUsers.users.forEach(user => {
        console.log(`   - ${user.email} (Auth UID: ${user.id})`);
      });
    }

    // Check 6: Test RLS with actual user session
    if (session) {
      console.log('\n📋 Step 5: Testing RLS with Current User');
      const { data: userRecord, error: userError } = await supabaseAnon
        .from('users')
        .select('id, email, role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (userError) {
        console.log('❌ Error fetching user record:', userError.message);
      } else if (!userRecord) {
        console.log('❌ User record not found in users table!');
        console.log('   Auth UID:', session.user.id);
        console.log('   This is the problem - the user needs to exist in the users table');
      } else {
        console.log('✅ User record found:');
        console.log(`   Email: ${userRecord.email}`);
        console.log(`   Role: ${userRecord.role}`);
        console.log(`   ID: ${userRecord.id}`);

        if (userRecord.role !== 'admin') {
          console.log('\n❌ User role is not "admin"!');
          console.log(`   Current role: ${userRecord.role}`);
          console.log('   This is why you cannot see organizations');
        }
      }

      // Check 7: Try to fetch organizations with user session
      console.log('\n📋 Step 6: Testing Organization Access with RLS');
      const { data: userOrgs, error: userOrgsError } = await supabaseAnon
        .from('organizations')
        .select('*');

      if (userOrgsError) {
        console.log('❌ RLS blocked access to organizations:');
        console.log(`   Error: ${userOrgsError.message}`);
        console.log(`   Code: ${userOrgsError.code}`);
        console.log(`   Details: ${userOrgsError.details}`);
        console.log(`   Hint: ${userOrgsError.hint}`);
      } else if (userOrgs) {
        console.log(`✅ User can access ${userOrgs.length} organization(s)`);
        userOrgs.forEach(org => {
          console.log(`   - ${org.name}`);
        });
      }
    }

    // Check 8: Verify RLS policies
    console.log('\n📋 Step 7: Checking RLS Policies');
    const { data: policies, error: policyError } = await supabaseAdmin
      .rpc('exec_sql', {
        query: `
          SELECT tablename, policyname, cmd, qual
          FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'organizations'
          ORDER BY policyname;
        `
      })
      .catch(() => {
        // Fallback if rpc doesn't exist
        return supabaseAdmin
          .from('pg_policies')
          .select('tablename, policyname, cmd, qual')
          .eq('schemaname', 'public')
          .eq('tablename', 'organizations');
      });

    if (policyError) {
      console.log('⚠️  Could not fetch RLS policies (this is okay)');
    } else if (policies) {
      console.log('✅ RLS Policies on organizations table:');
      if (Array.isArray(policies)) {
        policies.forEach(p => {
          console.log(`   - ${p.policyname} (${p.cmd})`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Diagnosis Complete\n');
}

diagnose();
