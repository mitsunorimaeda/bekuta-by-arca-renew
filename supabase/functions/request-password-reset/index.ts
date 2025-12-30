// supabase/functions/request-password-reset/index.ts

declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailType = "password_reset" | "invitation_resend";

interface ResetRequestBody {
  email: string;
  type?: EmailType;
  redirectUrl?: string;
  next?: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}
function ensureResetPasswordPath(baseOrFullUrl: string) {
  const url = normalizeBaseUrl(baseOrFullUrl);
  if (url.endsWith("/reset-password")) return url;
  return `${url}/reset-password`;
}
function normalizeNextPath(next?: string | null) {
  if (!next) return null;
  if (next.startsWith("http://") || next.startsWith("https://")) return null;
  if (!next.startsWith("/")) return null;
  return next;
}

function buildEmailCopy(params: {
  type: EmailType;
  userName?: string | null;
  actionUrl: string;
}) {
  const userName = params.userName || "ユーザー";
  const year = new Date().getFullYear();
  const isInviteResend = params.type === "invitation_resend";

  const subject = isInviteResend
    ? "🔁 Bekuta 招待リンクを再送しました"
    : "🔑 Bekuta パスワードリセット";

  const title = isInviteResend ? "🔁 招待リンク再送" : "🔑 パスワードリセット";
  const lead = isInviteResend
    ? "Bekutaへの招待リンクの再発行リクエストを受け付けました。"
    : "Bekutaのパスワードリセットのリクエストを受け付けました。";

  const note = isInviteResend
    ? "※このリンクは一定時間後に無効になります。"
    : "※このリンクは一定時間後に無効になります。\n※以前と同じパスワードは使用できません。";

  const buttonText = isInviteResend ? "手続きを進める" : "パスワードを再設定する";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:#3b82f6;color:white;padding:30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">${title}</h1>
    </div>
    <div style="padding:30px;">
      <p style="font-size:18px;color:#1f2937;margin:0 0 20px 0;">こんにちは、${userName}さん</p>
      <p style="color:#4b5563;line-height:1.6;">${lead}<br>以下のボタンから手続きを行ってください。</p>

      <a href="${params.actionUrl}" style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;padding:12px 30px;border-radius:8px;margin:20px 0;font-weight:600;">${buttonText}</a>

      <p style="color:#6b7280;font-size:12px;white-space:pre-line;">${note}</p>
      <p style="color:#6b7280;font-size:12px;">※このメールに心当たりがない場合は破棄してください。</p>
    </div>
    <div style="padding:20px;text-align:center;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
      <p style="margin:0;">© ${year} Bekuta</p>
    </div>
  </div>
</body></html>`;

  const text = `${title}

こんにちは、${userName}さん

${lead}
以下のリンクから手続きを行ってください。

${params.actionUrl}

${note}

※このメールに心当たりがない場合は破棄してください。

© ${year} Bekuta`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: ResetRequestBody = await req.json();
    const email = normalizeEmail(body.email || "");
    const type: EmailType =
      body.type === "invitation_resend" ? "invitation_resend" : "password_reset";

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const clientUrl = normalizeBaseUrl(
      Deno.env.get("CLIENT_URL") || "https://bekuta.netlify.app",
    );

    const redirectTo = body.redirectUrl
      ? ensureResetPasswordPath(body.redirectUrl)
      : `${clientUrl}/reset-password`;

    const nextFromBody = normalizeNextPath(body.next);
    const next =
      nextFromBody ??
      (type === "invitation_resend" ? "/" : "/reset-password");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ✅ プロファイル存在確認（漏洩防止のため、未存在でも成功で返す）
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "メールを送信しました（存在しない場合もこのメッセージが表示されます）。",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ✅ recovery link 発行
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("❌ generateLink failed:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate recovery link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyUrl = linkData.properties.action_link;

    // ✅ 先読み対策：/auth/callback に包む
    const callbackBase = `${clientUrl}/auth/callback`;
    const wrappedActionUrl =
      `${callbackBase}?verify=${encodeURIComponent(verifyUrl)}&next=${encodeURIComponent(next)}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromAddress = Deno.env.get("RESEND_FROM") || "Bekuta <noreply@arca.fit>";

    const { subject, html, text } = buildEmailCopy({
      type,
      userName: profile.name,
      actionUrl: wrappedActionUrl,
    });

    // 送信
    let deliveryStatus: "sent" | "failed" | "simulated" = "simulated";
    let resendId: string | null = null;
    let errorMessage: string | null = null;

    if (resendApiKey && resendApiKey.startsWith("re_")) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject,
          html,
          text,
        }),
      });

      const result = await r.json().catch(() => ({}));

      if (!r.ok) {
        deliveryStatus = "failed";
        errorMessage = JSON.stringify(result);
        console.error("❌ Resend API error:", result);

        // ✅ ここ重要：失敗は失敗として返す（UIで拾える）
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to send email",
            details: result,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        deliveryStatus = "sent";
        resendId = result.id ?? null;
      }
    }

    // ログ（存在するテーブル名に合わせて）
    try {
      await supabaseAdmin.from("email_logs").insert({
        to_email: email,
        subject,
        email_type: type,
        status: deliveryStatus,
        resend_id: resendId,
        error_message: errorMessage,
        sent_by: profile.id,
        metadata: { source: "request-password-reset", redirectTo, next },
      });
    } catch (e) {
      console.error("⚠️ email_logs insert failed (ignored):", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          type === "invitation_resend"
            ? "招待リンクを再送しました（メールをご確認ください）。"
            : "パスワードリセットメールを送信しました（メールをご確認ください）。",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("❌ Unexpected error in request-password-reset:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});