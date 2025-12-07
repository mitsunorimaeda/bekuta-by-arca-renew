import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserRequest {
  name: string;
  email: string;
  role: 'athlete' | 'staff' | 'admin';
  teamId?: string;
  organizationId?: string;
  redirectUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: CreateUserRequest = await req.json();
    const { name, email, role, teamId, organizationId, redirectUrl } = requestData;

    if (!name || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['athlete', 'staff', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be athlete, staff, or admin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (role === 'athlete' && !teamId) {
      return new Response(
        JSON.stringify({ error: 'Team ID is required for athletes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUserError) {
      console.error('Error checking existing user:', existingUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate random temporary password (user won't use this)
    const generateTempPassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 24; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const temporaryPassword = generateTempPassword();

    console.log('🚀 Creating user:', email);

    // Create user with temporary password
    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role,
        team_id: role === 'athlete' ? teamId : null,
        created_by: user.id,
        requires_password_change: true
      }
    });

    if (createUserError) {
      console.error('User creation error:', createUserError);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User created successfully');

    // Generate password reset link
    const redirectTo = redirectUrl || Deno.env.get('SUPABASE_URL') || '';
    const { data: resetLinkData, error: resetLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo
      }
    });

    if (resetLinkError || !resetLinkData) {
      console.error('Failed to generate password reset link:', resetLinkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate password setup link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔗 Password setup link generated');

    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('User profile fetch error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileError?.message || 'Profile not found'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (role === 'staff' && teamId) {
      const { error: linkError } = await supabaseAdmin
        .from('staff_team_links')
        .insert({ staff_user_id: authUser.user.id, team_id: teamId });
      if (linkError) {
        console.error('Staff team link error:', linkError);
      }
    }

    // Add user to organization as member if organizationId is provided
    if (organizationId) {
      console.log('👥 Adding user to organization:', organizationId);
      const { error: orgMemberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: authUser.user.id,
          role: 'member'
        });

      if (orgMemberError) {
        console.error('❌ Failed to add user to organization:', orgMemberError);
      } else {
        console.log('✅ User added to organization as member');
      }
    }

    console.log('📤 Returning password setup link');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userProfile.id,
          user_id: userProfile.user_id,
          name: userProfile.name,
          email: userProfile.email,
          role: userProfile.role,
          team_id: userProfile.team_id
        },
        passwordSetupLink: resetLinkData.properties.action_link,
        message: 'User created successfully. Password setup link generated.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
