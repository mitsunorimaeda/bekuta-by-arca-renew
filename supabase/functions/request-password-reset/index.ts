// supabase/functions/request-password-reset/index.ts
// recoveryリンクを発行して Resend でメール送信
// typeで「パスワード忘れ」or「招待リンク再送」を切り替える

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

  /**
   * 任意: "password_reset" | "invitation_resend"
   * 省略時は "password_reset"
   */
  type?: EmailType;

  /**
   * 任意:
   * - フルURL: https://bekuta.netlify.app/reset-password
   * - 省略時: CLIENT_URL + "/reset-password"
   */
  redirectUrl?: string;
}

// ---------------------------
// メールテンプレ
// ---------------------------
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

  const buttonText = isInviteResend ? "招待リンクを開く" : "パスワードを再設定する";

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
      <p style="color:#6b7280;font-size:12px;">
        ※このメールに心当たりがない場合は破棄してください。
      </p>
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

━━━━━━━━━━━━━━━━━━━━━━
© ${year} Bekuta`;

  return { subject, html, text };
}

// ---------------------------
// Util
// ---------------------------
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function ensureResetPasswordPath(baseOrFullUrl: string) {
  const url = normalizeBaseUrl(baseOrFullUrl);
  // すでに /reset-password を含むならそのまま
  if (url.endsWith("/reset-password")) return url;
  // base の場合は付与
  return `${url}/reset-password`;
}

// ---------------------------
// main
// ---------------------------
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
    const type: EmailType = body.type === "invitation_resend" ? "invitation_resend" : "password_reset";

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

    // redirectTo は「必ず /reset-password」に寄せる（上書き可）
    const redirectTo = body.redirectUrl
      ? ensureResetPasswordPath(body.redirectUrl)
      : `${clientUrl}/reset-password`;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1) ユーザープロファイルを取得（存在確認＋名前取得）
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError);
      // ここで失敗しても「存在漏洩防止」のため success 返す方針にするなら後続の処理を落とす
      // ただし recovery link の発行もできないので、ここは内部エラー扱いでもOK。
      // 今回は“確実性”より“安全性(存在非公開)”優先で success を返す。
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "メールを送信しました（存在しない場合もこのメッセージが表示されます）。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ユーザーが存在しない場合でも「成功」と返す（存在漏洩防止）
    if (!profile) {
      console.log("ℹ️ No user found for email (silent):", email);
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "メールを送信しました（存在しない場合もこのメッセージが表示されます）。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Supabaseの「recovery」リンクを発行
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

    if (linkError || !linkData) {
      console.error("❌ Failed to generate recovery link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate recovery link" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const actionUrl = linkData.properties.action_link;
    console.log("🔗 Generated recovery link:", { email, type, redirectTo });

    // 3) Resend でメール送信
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromAddress = "Bekuta <noreply@arca.fit>";

    const { subject, html, text } = buildEmailCopy({
      type,
      userName: profile.name,
      actionUrl,
    });

    let deliveryStatus: "sent" | "failed" | "simulated" = "simulated";
    let resendId: string | null = null;
    let errorMessage: string | null = null;

    if (resendApiKey && resendApiKey.startsWith("re_")) {
      try {
        console.log("📮 Sending email via Resend...", { email, type });
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

        const result = await r.json();

        if (!r.ok) {
          deliveryStatus = "failed";
          errorMessage = JSON.stringify(result);
          console.error("❌ Resend API error:", result);
        } else {
          deliveryStatus = "sent";
          resendId = result.id;
          console.log("✅ Email sent:", { resendId, email, type });
        }
      } catch (err: any) {
        deliveryStatus = "failed";
        errorMessage = err?.message || "Unknown error";
        console.error("❌ Resend integration error:", err);
      }
    } else {
      console.log("ℹ️ RESEND_API_KEY not configured or invalid. Simulating send.");
    }

    // 4) ログテーブルに記録（あれば）
    try {
      await supabaseAdmin.from("email_delivery_log").insert({
        to_email: email,
        subject,
        email_type: type, // ✅ type をそのまま保存
        status: deliveryStatus,
        resend_id: resendId,
        error_message: errorMessage,
        sent_by: profile.id, // 実運用上は「リクエストした本人」等にしたければ別設計
        metadata: {
          source: "request-password-reset",
          redirectTo,
        },
      });
    } catch (logErr) {
      console.error("⚠️ Failed to insert email_delivery_log:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          type === "invitation_resend"
            ? "招待リンクを再送しました（メールをご確認ください）。"
            : "パスワードリセットメールを送信しました（メールをご確認ください）。",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("❌ Unexpected error in request-password-reset:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error?.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});