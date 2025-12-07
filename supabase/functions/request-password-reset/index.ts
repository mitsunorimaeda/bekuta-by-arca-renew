// supabase/functions/request-password-reset/index.ts
// パスワードリセット用のリカバリリンクを発行して、Resend経由でメール送信する

declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetRequestBody {
  email: string;
  /**
   * 任意:
   * - フルURL: https://bekuta.netlify.app
   * - 省略時: CLIENT_URL or https://bekuta.netlify.app
   */
  redirectUrl?: string;
}

// メールテンプレート（HTML）
function generatePasswordResetEmailHTML(data: {
  userName?: string | null;
  resetUrl: string;
}) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>パスワードリセット</title></head><body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><div style="background:#3b82f6;color:white;padding:30px;text-align:center;"><h1 style="margin:0;font-size:24px;">🔑 パスワードリセット</h1></div><div style="padding:30px;"><p style="font-size:18px;color:#1f2937;margin:0 0 20px 0;">こんにちは、${
    data.userName || "ユーザー"
  }さん</p><p style="color:#4b5563;line-height:1.6;">Bekutaのパスワードリセットのリクエストを受け付けました。<br>以下のボタンからパスワードの再設定を行ってください。</p><a href="${
    data.resetUrl
  }" style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;padding:12px 30px;border-radius:8px;margin:20px 0;font-weight:600;">パスワードを再設定する</a><p style="color:#6b7280;font-size:12px;">※このリンクは一定時間後に無効になります。<br>※このメールに心当たりがない場合は破棄してください。</p></div><div style="padding:20px;text-align:center;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;"><p style="margin:0;">© ${new Date().getFullYear()} Bekuta</p></div></div></body></html>`;
}

// プレーンテキスト
function generatePasswordResetEmailText(data: {
  userName?: string | null;
  resetUrl: string;
}) {
  return `パスワードリセットのお知らせ

こんにちは、${data.userName || "ユーザー"}さん

Bekutaのパスワードリセットのリクエストを受け付けました。
以下のリンクからパスワードの再設定を行ってください。

${data.resetUrl}

※このリンクは一定時間後に無効になります。
※このメールに心当たりがない場合は破棄してください。

━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} Bekuta`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body: ResetRequestBody = await req.json();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const clientUrl =
      (Deno.env.get("CLIENT_URL") || "https://bekuta.netlify.app").replace(
        /\/$/,
        "",
      );

    const redirectTo = body.redirectUrl
      ? body.redirectUrl
      : clientUrl; // 例: https://bekuta.netlify.app

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1) ユーザープロファイルを取得（存在確認＋名前取得）
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError);
      // ただしクライアントには「送った」と返して良い（存在非公開のため）
    }

    // ユーザーが存在しない場合でも「成功」と返す（存在漏洩防止）
    if (!profile) {
      console.log("ℹ️ No user found for email (silent):", email);
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "パスワードリセットメールを送信しました（存在しない場合もこのメッセージが表示されます）。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Supabaseの「recovery」リンクを発行
    const { data: resetLinkData, error: resetLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo,
        },
      });

    if (resetLinkError || !resetLinkData) {
      console.error("❌ Failed to generate recovery link:", resetLinkError);
      return new Response(
        JSON.stringify({
          error: "Failed to generate password reset link",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const resetUrl = resetLinkData.properties.action_link;
    console.log("🔗 Generated recovery link:", resetUrl);

    // 3) Resend でメール送信
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailType = "password_reset";
    let deliveryStatus = "simulated";
    let resendId: string | null = null;
    let errorMessage: string | null = null;

    const subject = "🔑 Bekuta パスワードリセット";
    const html = generatePasswordResetEmailHTML({
      userName: profile.name,
      resetUrl,
    });
    const text = generatePasswordResetEmailText({
      userName: profile.name,
      resetUrl,
    });

    if (resendApiKey && resendApiKey.startsWith("re_")) {
      try {
        console.log("📮 Sending password reset email via Resend...");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Bekuta <noreply@arca.fit>",
            to: [email],
            subject,
            html,
            text,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("❌ Resend API error:", result);
          deliveryStatus = "failed";
          errorMessage = JSON.stringify(result);
        } else {
          console.log("✅ Password reset email sent:", result);
          deliveryStatus = "sent";
          resendId = result.id;
        }
      } catch (err: any) {
        console.error("❌ Resend integration error:", err);
        deliveryStatus = "failed";
        errorMessage = err.message;
      }
    } else {
      console.log(
        "ℹ️ RESEND_API_KEY not configured or invalid. Simulating email send.",
      );
    }

    // 4) ログテーブルに記録（あれば）
    try {
      await supabaseAdmin.from("email_delivery_log").insert({
        to_email: email,
        subject,
        email_type: emailType,
        status: deliveryStatus,
        resend_id: resendId,
        error_message: errorMessage,
        sent_by: profile.id, // or null
        metadata: {
          source: "request-password-reset",
        },
      });
    } catch (logErr) {
      console.error("⚠️ Failed to insert email_delivery_log:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "パスワードリセットメールを送信しました（メールをご確認ください）。",
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