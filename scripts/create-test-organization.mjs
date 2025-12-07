import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🏢 Creating Test Organization Data\n');
console.log('='.repeat(60));

async function createTestData() {
  try {
    // Step 1: Set admin user
    console.log('\n📋 Step 1: Setting up admin user');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('email', 'info@arca.fit')
      .select()
      .single();

    if (adminError) {
      console.log('❌ Error setting admin:', adminError.message);
      return;
    }
    console.log('✅ Admin user set:', adminUser.email);

    // Step 2: Create test organization
    console.log('\n📋 Step 2: Creating test organization');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'ARCA アスリートサポート',
        description: 'トレーニング管理とアスリートサポートを提供する組織'
      })
      .select()
      .single();

    if (orgError) {
      console.log('❌ Error creating organization:', {
        message: orgError.message,
        details: orgError.details,
        hint: orgError.hint,
        code: orgError.code
      });

      if (orgError.code === '23505') {
        console.log('⚠️  Organization already exists, fetching existing...');
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select()
          .eq('name', 'ARCA アスリートサポート')
          .single();

        if (existingOrg) {
          console.log('✅ Using existing organization:', existingOrg.name);
          console.log('\n✨ Organization hierarchy is ready!');
          console.log('\n📊 Summary:');
          console.log(`   Organization: ${existingOrg.name}`);
          console.log(`   Admin User: ${adminUser.email}`);
          console.log('\n💡 Next steps:');
          console.log('   1. Log in as info@arca.fit');
          console.log('   2. Navigate to the admin dashboard');
          console.log('   3. Click on "組織管理" tab');
          console.log('   4. Start creating departments and managing teams');
          return;
        }
      }
      return;
    }
    console.log('✅ Organization created:', org.name);
    console.log('   ID:', org.id);

    // Step 3: Add admin as organization member
    console.log('\n📋 Step 3: Adding admin to organization');
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: adminUser.id,
        organization_id: org.id,
        role: 'organization_admin'
      })
      .select()
      .single();

    if (memberError) {
      console.log('❌ Error adding member:', memberError.message);
      return;
    }
    console.log('✅ Admin added as organization admin');

    // Step 4: Create sample departments
    console.log('\n📋 Step 4: Creating sample departments');
    const departments = [
      { name: '競技チーム', description: 'アスリートのための競技チーム' },
      { name: 'トレーニング部門', description: 'トレーニング指導とサポート' }
    ];

    for (const dept of departments) {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          organization_id: org.id,
          name: dept.name,
          description: dept.description
        })
        .select()
        .single();

      if (error) {
        console.log(`  ⚠️  Could not create "${dept.name}":`, error.message);
      } else {
        console.log(`  ✅ Created department: ${data.name}`);
      }
    }

    // Step 5: Get all teams and optionally assign to organization
    console.log('\n📋 Step 5: Checking existing teams');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*');

    if (teamsError) {
      console.log('⚠️  Could not fetch teams:', teamsError.message);
    } else if (teams && teams.length > 0) {
      console.log(`✅ Found ${teams.length} existing team(s)`);
      console.log('   Teams can be assigned to this organization through the UI');
    } else {
      console.log('   No existing teams found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Test organization setup complete!\n');
    console.log('📊 Summary:');
    console.log(`   Organization: ${org.name}`);
    console.log(`   Admin User: ${adminUser.email}`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Existing Teams: ${teams?.length || 0}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Log in as info@arca.fit');
    console.log('   2. Navigate to the admin dashboard');
    console.log('   3. Click on "組織管理" tab');
    console.log('   4. You should see the "ARCA アスリートサポート" organization');
    console.log('   5. Click on it to manage departments and assign teams');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }
}

createTestData();
