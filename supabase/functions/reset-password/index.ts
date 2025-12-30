// supabase/functions/reset-password/index.ts
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  // 管理者強制変更後に「本人に次回変更させる」なら true
  requireChangeNextLogin?: boolean;
}

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(pw: string) {
  // 最低条件（必要なら強化）
  if (pw.length < 12) return "Password must be at least 12 characters.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing authorization header" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return json(500, {
        error:
          "Missing env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY",
      });
    }

    // ① 呼び出し元のJWTを検証（anonクライアント）
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);
    const token = authHeader.replace("Bearer ", "").trim();

    const {
      data: { user: caller },
      error: callerAuthError,
    } = await supabaseClient.auth.getUser(token);

    if (callerAuthError || !caller) {
      return json(401, { error: "Invalid authentication" });
    }

    // ② admin権限操作用（service role）
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ③ 呼び出しユーザーが global_admin か確認（ここが超重要）
    const { data: callerRow, error: callerRowErr } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerRowErr) {
      return json(500, { error: "Failed to verify caller role" });
    }
    if (callerRow?.role !== "global_admin") {
      return json(403, { error: "Global admin access required" });
    }

    // ④ リクエスト取得
    const body: ResetPasswordRequest = await req.json();
    const email = normalizeEmail(body.email || "");
    const newPassword = body.newPassword || "";
    const requireChangeNextLogin = body.requireChangeNextLogin ?? false;

    if (!email || !newPassword) {
      return json(400, { error: "Email and newPassword are required" });
    }

    const pwErr = validatePassword(newPassword);
    if (pwErr) return json(400, { error: pwErr });

    // ⑤ auth.users をSQLで引けるならそれが最速（service roleなのでOK）
    //    ※Supabase環境によっては auth スキーマへの参照が制限される場合あり
    //    その場合は listUsers のページングにフォールバックする
    let targetUserId: string | null = null;

    try {
      const { data: rows, error: authSqlErr } = await supabaseAdmin
        .rpc("get_auth_user_id_by_email", { p_email: email });

      // RPCがある前提（なければここは失敗してOK → listUsersへフォールバック）
      if (!authSqlErr && rows?.[0]?.id) {
        targetUserId = rows[0].id;
      }
    } catch {
      // ignore
    }

    // ⑥ フォールバック：listUsersをページングで探す（確実）
    if (!targetUserId) {
      let page = 1;
      const perPage = 1000;

      while (page <= 20) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          console.error("listUsers error:", error);
          return json(500, { error: "Failed to find user" });
        }

        const found = data?.users?.find((u: any) =>
          ((u.email || "").toLowerCase() === email)
        );

        if (found?.id) {
          targetUserId = found.id;
          break;
        }

        // これ以上いないなら終了
        if (!data?.users || data.users.length < perPage) break;

        page += 1;
      }
    }

    if (!targetUserId) {
      return json(404, { error: "User not found" });
    }

    // ⑦ パスワード更新
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        password: newPassword,
        user_metadata: {
          requires_password_change: requireChangeNextLogin,
          updated_by: caller.id,
          updated_at: new Date().toISOString(),
        },
      }
    );

    if (updateErr) {
      console.error("Password update error:", updateErr);
      return json(400, { error: `Failed to update password: ${updateErr.message}` });
    }

    return json(200, { success: true, message: "Password reset successfully" });
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return json(500, { error: "Internal server error", details: e?.message ?? String(e) });
  }
});