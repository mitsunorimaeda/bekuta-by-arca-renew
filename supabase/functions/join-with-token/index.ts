// supabase/functions/join-with-token/index.ts
// チーム別シェアリンク自己登録 Edge Function
//
// GET  /functions/v1/join-with-token?token=xxx  → トークン情報取得（チーム名・ロール等）
// POST /functions/v1/join-with-token            → ユーザー登録実行

declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < 24; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing env vars' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  // ===== GET: トークン検証 & チーム情報返却 =====
  if (req.method === 'GET') {
    if (!token) return json(400, { error: 'token is required' });

    const { data: inviteToken, error } = await supabaseAdmin
      .from('team_invite_tokens')
      .select(`
        id, token, role, is_active, expires_at, max_uses, use_count, label,
        team_id, organization_id,
        teams:team_id (name),
        organizations:organization_id (name)
      `)
      .eq('token', token)
      .maybeSingle();

    if (error || !inviteToken) {
      return json(404, { error: '招待リンクが見つかりません' });
    }

    if (!inviteToken.is_active) {
      return json(400, { error: 'この招待リンクは無効化されています' });
    }

    if (inviteToken.expires_at && new Date(inviteToken.expires_at) < new Date()) {
      return json(400, { error: '招待リンクの有効期限が切れています' });
    }

    if (inviteToken.max_uses !== null && inviteToken.use_count >= inviteToken.max_uses) {
      return json(400, { error: 'この招待リンクの利用上限に達しました' });
    }

    return json(200, {
      valid: true,
      role: inviteToken.role,
      teamId: inviteToken.team_id,
      teamName: (inviteToken.teams as any)?.name ?? null,
      organizationId: inviteToken.organization_id,
      organizationName: (inviteToken.organizations as any)?.name ?? null,
      label: inviteToken.label,
      requiresApproval: inviteToken.role === 'staff',
    });
  }

  // ===== POST: ユーザー登録 =====
  if (req.method === 'POST') {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const { token: bodyToken, name, email, password } = body;
    const resolvedToken = bodyToken ?? token;

    if (!resolvedToken || !name || !email || !password) {
      return json(400, { error: 'token, name, email, password は必須です' });
    }

    if (password.length < 8) {
      return json(400, { error: 'パスワードは8文字以上で設定してください' });
    }

    // トークン再検証
    const { data: inviteToken, error: tokenError } = await supabaseAdmin
      .from('team_invite_tokens')
      .select('id, role, team_id, organization_id, is_active, expires_at, max_uses, use_count')
      .eq('token', resolvedToken)
      .maybeSingle();

    if (tokenError || !inviteToken) {
      return json(404, { error: '招待リンクが見つかりません' });
    }

    if (!inviteToken.is_active) {
      return json(400, { error: 'この招待リンクは無効化されています' });
    }

    if (inviteToken.expires_at && new Date(inviteToken.expires_at) < new Date()) {
      return json(400, { error: '招待リンクの有効期限が切れています' });
    }

    if (inviteToken.max_uses !== null && inviteToken.use_count >= inviteToken.max_uses) {
      return json(400, { error: 'この招待リンクの利用上限に達しました' });
    }

    // 既存ユーザー確認
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return json(400, { error: 'このメールアドレスは既に登録されています' });
    }

    const isAthlete = inviteToken.role === 'athlete';
    const isActiveOnCreate = isAthlete; // 選手は即時有効、スタッフは承認待ち

    // auth.users 作成
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: inviteToken.role,
        team_id: inviteToken.team_id,
        requires_password_change: false,
        registered_via_invite_token: resolvedToken,
      },
    });

    if (createError || !authUser.user) {
      console.error('User creation error:', createError);
      return json(400, { error: `ユーザー作成に失敗しました: ${createError?.message}` });
    }

    // users テーブルへのプロフィール挿入（トリガーがあれば不要だが念のため）
    await new Promise((r) => setTimeout(r, 600));

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authUser.user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin.from('users').insert({
        id: authUser.user.id,
        name,
        email,
        role: inviteToken.role,
        team_id: inviteToken.role === 'athlete' ? inviteToken.team_id : null,
        is_active: isActiveOnCreate,
      });

      if (profileError) {
        console.error('Profile insert error:', profileError);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return json(500, { error: 'プロフィール作成に失敗しました' });
      }
    } else {
      // トリガーで作られた場合は is_active だけ更新
      await supabaseAdmin
        .from('users')
        .update({ is_active: isActiveOnCreate })
        .eq('id', authUser.user.id);
    }

    // チームリンク（athlete は team_id で十分、staff は staff_team_links）
    if (inviteToken.role === 'staff' && inviteToken.team_id) {
      await supabaseAdmin.from('staff_team_links').insert({
        staff_user_id: authUser.user.id,
        team_id: inviteToken.team_id,
      });
    }

    // 組織メンバー追加
    if (inviteToken.organization_id) {
      await supabaseAdmin.from('organization_members').insert({
        organization_id: inviteToken.organization_id,
        user_id: authUser.user.id,
        role: 'member',
      });
    }

    // use_count インクリメント
    await supabaseAdmin
      .from('team_invite_tokens')
      .update({ use_count: inviteToken.use_count + 1 })
      .eq('id', inviteToken.id);

    console.log(`✅ User registered via invite token: ${email} as ${inviteToken.role}`);

    return json(200, {
      success: true,
      requiresApproval: !isActiveOnCreate,
      message: isActiveOnCreate
        ? '登録が完了しました。ログインしてください。'
        : '登録申請を受け付けました。管理者の承認をお待ちください。',
    });
  }

  return json(405, { error: 'Method not allowed' });
});
