// supabase/functions/create-user/index.ts
// ✅ global_admin / parent 対応 丸コピペ版

declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AppRole = 'athlete' | 'staff' | 'parent' | 'global_admin';

interface CreateUserRequest {
  name: string;
  email: string;
  role: AppRole;
  teamId?: string;
  organizationId?: string;
  redirectUrl?: string; // 推奨: `${origin}/reset-password`
}

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * redirectUrl を最低限バリデーションして、安全なURLだけ採用する
 * - 許可したいオリジンに合わせて調整
 */
function resolveRedirectTo(input?: string) {
  const FALLBACK =
    Deno.env.get('APP_URL') || 'https://bekuta.netlify.app/reset-password';

  if (!input) return FALLBACK;

  try {
    const u = new URL(input);

    const allowedOrigins = new Set<string>([
      'https://bekuta.netlify.app',
      // 'http://localhost:5173',
    ]);

    const forced = new URL(u.toString());
    forced.pathname = '/reset-password';

    const isAllowedOrigin = allowedOrigins.has(forced.origin);
    if (!isAllowedOrigin) return FALLBACK;

    const isHttps = forced.protocol === 'https:';
    if (!isHttps && forced.origin !== 'http://localhost:5173') return FALLBACK;

    return forced.toString();
  } catch {
    return FALLBACK;
  }
}

// Generate random temporary password (user won't use this)
function generateTempPassword() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

Deno.serve(async (req) => {
  // preflight
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

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return json(401, { error: 'Invalid authentication' });
    }

    // ✅ 呼び出しユーザーの権限チェック（admin → global_admin）
    const { data: caller, error: callerError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || !caller?.role) {
      return json(403, { error: 'Admin access required' });
    }

    // ✅ ここが本丸：global_admin だけ許可（必要なら staff も許可可能）
    const isAllowedCaller = caller.role === 'global_admin';
    if (!isAllowedCaller) {
      return json(403, { error: 'Admin access required' });
    }

    const requestData: CreateUserRequest = await req.json();
    const { name, email, role, teamId, organizationId, redirectUrl } =
      requestData;

    if (!name || !email || !role) {
      return json(400, {
        error: 'Missing required fields: name, email, role',
      });
    }

    const allowedRoles: AppRole[] = ['athlete', 'staff', 'parent', 'global_admin'];
    if (!allowedRoles.includes(role)) {
      return json(400, {
        error: 'Invalid role. Must be athlete, staff, parent, or global_admin',
      });
    }

    // athlete は team 必須（親は team 不要、staff は任意）
    if (role === 'athlete' && !teamId) {
      return json(400, { error: 'Team ID is required for athletes' });
    }

    // 既存ユーザー確認
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUserError) {
      console.error('Error checking existing user:', existingUserError);
      return json(500, { error: 'Failed to check existing user' });
    }

    if (existingUser) {
      return json(400, { error: 'User with this email already exists' });
    }

    const temporaryPassword = generateTempPassword();
    console.log('🚀 Creating user:', email);

    // auth user 作成（temporary password）
    const { data: authUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          team_id: role === 'athlete' ? teamId : null,
          created_by: user.id,
          requires_password_change: true,
        },
      });

    if (createUserError) {
      console.error('User creation error:', createUserError);
      return json(400, {
        error: `Failed to create user: ${createUserError.message}`,
      });
    }

    if (!authUser.user) {
      return json(400, { error: 'Failed to create user' });
    }

    console.log('✅ User created successfully:', authUser.user.id);

    // ✅ redirectTo を安全に解決（/reset-password に寄せる）
    const redirectTo = resolveRedirectTo(redirectUrl);

    // recovery link 生成
    const { data: resetLinkData, error: resetLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });

    if (resetLinkError || !resetLinkData?.properties?.action_link) {
      console.error('Failed to generate password reset link:', resetLinkError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      } catch (e) {
        console.error('cleanup deleteUser failed:', e);
      }
      return json(500, { error: 'Failed to generate password setup link' });
    }

    console.log('🔗 Password setup link generated:', redirectTo);

    // DB反映待ち（必要なら）
    await new Promise((resolve) => setTimeout(resolve, 500));

    // users テーブルのプロフィール確認（トリガー等で作ってる想定）
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('User profile fetch error:', profileError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      } catch (e) {
        console.error('cleanup deleteUser failed:', e);
      }
      return json(400, {
        error: `Failed to create user profile: ${
          profileError?.message || 'Profile not found'
        }`,
      });
    }

    // staff の場合 team link
    if (role === 'staff' && teamId) {
      const { error: linkError } = await supabaseAdmin
        .from('staff_team_links')
        .insert({ staff_user_id: authUser.user.id, team_id: teamId });

      if (linkError) {
        console.error('Staff team link error:', linkError);
      }
    }

    // organization member 追加
    if (organizationId) {
      console.log('👥 Adding user to organization:', organizationId);

      const { error: orgMemberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: authUser.user.id,
          role: 'member',
        });

      if (orgMemberError) {
        console.error('❌ Failed to add user to organization:', orgMemberError);
      } else {
        console.log('✅ User added to organization as member');
      }
    }

    return json(200, {
      success: true,
      user: {
        id: userProfile.id,
        user_id: userProfile.user_id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        team_id: userProfile.team_id,
      },
      passwordSetupLink: resetLinkData.properties.action_link,
      redirectToUsed: redirectTo,
      message: 'User created successfully. Password setup link generated.',
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return json(500, {
      error: 'Internal server error',
      details: error?.message ?? String(error),
    });
  }
});