// 先頭付近
declare const Deno: any;
// 👇 ここを変更
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpdateUserRequest {
  userId: string;
  name: string;
  email: string;
  role: 'athlete' | 'staff' | 'admin';
  teamId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create regular client to verify the requesting user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify the requesting user is authenticated and is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if the user is an admin using supabaseAdmin to bypass RLS
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the request body
    const requestData: UpdateUserRequest = await req.json();
    const { userId, name, email, role, teamId } = requestData;

    // Validate required fields
    if (!userId || !name || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate role
    if (!['athlete', 'staff', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate team requirement for athletes
    if (role === 'athlete' && !teamId) {
      return new Response(
        JSON.stringify({ error: 'Team ID required for athletes' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user exists
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 1: Update user profile
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        name,
        email,
        role,
        team_id: role === 'athlete' ? teamId : null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('User update error:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update user: ${updateError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Handle staff team links
    // First, remove existing staff team links
    const { error: deleteLinksError } = await supabaseAdmin
      .from('staff_team_links')
      .delete()
      .eq('staff_user_id', userId);

    if (deleteLinksError) {
      console.error('Error deleting staff team links:', deleteLinksError);
      return new Response(
        JSON.stringify({ error: `Failed to update staff team links: ${deleteLinksError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If the user is staff and has a team, create new staff team link
    if (role === 'staff' && teamId) {
      const { error: linkError } = await supabaseAdmin
        .from('staff_team_links')
        .insert({
          staff_user_id: userId,
          team_id: teamId
        });

      if (linkError) {
        console.error('Error creating staff team link:', linkError);
        return new Response(
          JSON.stringify({ error: `Failed to create staff team link: ${linkError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User updated successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});