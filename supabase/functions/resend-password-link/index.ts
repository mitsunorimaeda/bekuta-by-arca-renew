// supabase/functions/resend-password-link/index.ts
declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Role = 'athlete' | 'staff' | 'admin';

interface ResendPasswordLinkRequest {
  email: string;
  redirectUrl?: string; // 例: https://bekuta.netlify.app/reset-password
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const clientUrl = Deno.env.get('CLIENT_URL') ?? ''; // 例: https://bekuta.netlify.app

    const body: ResendPasswordLinkRequest = await req.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing required field: email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ redirectTo は必ずあなたのフロントの /reset-password に寄せる
    const redirectTo =
      body.redirectUrl?.trim() ||
      (clientUrl ? `${clientUrl}/reset-password` : '');

    // 1) ユーザー存在確認（※存在しなくても成功っぽく返すための内部処理）
    // auth.users から探す
    const { data: authUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });

    if (listErr) {
      console.error('listUsers error:', listErr);
      // セキュリティのため詳細は出さない
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const found = authUsers?.users?.find((u: any) => (u.email || '').toLowerCase() === email);

    // 見つからなくても「送った体」で返す（アカウント有無の漏洩を防ぐ）
    if (!found) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) recovery link 再発行
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('generateLink error:', linkErr);
      // ここも詳細は出さない
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const passwordSetupLink = linkData.properties.action_link;

    // 3) メール送信：既存の send-email Edge Function を使う（あなたの一括招待と同じ方式）
    // type: 'invitation' をそのまま流用してOK（文言だけ “再発行” に寄せたいならテンプレ側で分岐）
    try {
      const authHeader = req.headers.get('Authorization') || '';
      // send-email 側が Authorization を要求するなら引き継ぐ
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          type: 'invitation',
          data: {
            name: found.user_metadata?.name || 'ユーザー',
            email,
            role: (found.user_metadata?.role as Role) || 'athlete',
            teamName: undefined,
            passwordSetupLink,
            expiresInHours: 24,
            isResend: true, // ✅ テンプレ側で文言切替したければ使える
          },
        }),
      });

      if (!emailRes.ok) {
        const t = await emailRes.text();
        console.error('send-email failed:', emailRes.status, t);
        // ここも成功風で返す（再送可否が漏れないように）
      }
    } catch (e) {
      console.error('send-email exception:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});