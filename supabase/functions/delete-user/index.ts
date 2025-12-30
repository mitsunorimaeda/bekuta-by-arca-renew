// supabase/functions/delete-user/index.ts

declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteUserRequest {
  userId: string;
}

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { error: 'Missing authorization header' });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return json(500, {
        error:
          'Missing env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY',
      });
    }

    // Admin client (service role)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Regular client (anon) for verifying caller token
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

    // Verify caller is authenticated
    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return json(401, { error: 'Invalid authentication' });
    }

    // ✅ Check caller role (global_admin only)
    const { data: caller, error: callerError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError) {
      return json(500, { error: 'Failed to verify caller role' });
    }

    if (caller?.role !== 'global_admin') {
      return json(403, { error: 'Global admin access required' });
    }

    // Parse request body
    const requestData: DeleteUserRequest = await req.json();
    const { userId } = requestData;

    if (!userId) {
      return json(400, { error: 'User ID is required' });
    }

    // Prevent deleting self
    if (userId === user.id) {
      return json(400, { error: 'Cannot delete your own account' });
    }

    // Ensure target user exists
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return json(404, { error: 'User not found' });
    }

    // Optional safety: prevent deleting another global_admin (必要ならON)
    // if (targetUser.role === 'global_admin') {
    //   return json(400, { error: 'Cannot delete another global admin' });
    // }

    // Step A: delete staff links
    const { error: staffLinksError } = await supabaseAdmin
      .from('staff_team_links')
      .delete()
      .eq('staff_user_id', userId);

    if (staffLinksError) {
      return json(400, {
        error: `Failed to delete staff team links: ${staffLinksError.message}`,
      });
    }

    // Step B: delete org memberships (FK cascadeが無い場合に備えて掃除)
    const { error: orgMemberDeleteError } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('user_id', userId);

    if (orgMemberDeleteError) {
      return json(400, {
        error: `Failed to delete organization memberships: ${orgMemberDeleteError.message}`,
      });
    }

    // Step C: delete tutorial progress (残骸防止)
    const { error: tutorialDeleteError } = await supabaseAdmin
      .from('tutorial_progress')
      .delete()
      .eq('user_id', userId);

    if (tutorialDeleteError) {
      return json(400, {
        error: `Failed to delete tutorial progress: ${tutorialDeleteError.message}`,
      });
    }

    // Step D: delete user profile row
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return json(400, {
        error: `Failed to delete user profile: ${profileError.message}`,
      });
    }

    // Step E: delete auth user
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      return json(400, {
        error: `Failed to delete auth user: ${authDeleteError.message}`,
      });
    }

    return json(200, { success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error?.message ?? String(error),
    });
  }
});