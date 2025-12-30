// supabase/functions/update-user/index.ts
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppRole = "athlete" | "staff" | "parent" | "global_admin";

interface UpdateUserRequest {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  teamId?: string | null;
  // 必要なら organizationId も追加できる
}

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // service role（RLSバイパス）
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    // caller verify（anon）
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

    // caller auth
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !caller) return json(401, { error: "Invalid authentication" });

    // caller が global_admin か確認（超重要）
    const { data: callerRow, error: callerErr } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerErr) return json(500, { error: "Failed to verify caller role" });
    if (callerRow?.role !== "global_admin") {
      return json(403, { error: "Global admin access required" });
    }

    // body
    const body: UpdateUserRequest = await req.json();
    const { userId, name, email, role, teamId } = body;

    if (!userId || !name || !email || !role) {
      return json(400, { error: "Missing required fields" });
    }

    // role validation（あなたのDB制約に合わせる）
    if (!["athlete", "staff", "parent", "global_admin"].includes(role)) {
      return json(400, { error: "Invalid role" });
    }

    // athlete の team 必須
    if (role === "athlete" && !teamId) {
      return json(400, { error: "Team ID required for athletes" });
    }

    // 対象ユーザー存在確認
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (existingUserError || !existingUser) {
      return json(404, { error: "User not found" });
    }

    // ① users テーブル更新（プロフィール側）
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        name,
        email,
        role,
        team_id: role === "athlete" ? teamId : null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("User update error:", updateError);
      return json(400, { error: `Failed to update user: ${updateError.message}` });
    }

    // ② staff_team_links を更新（staff のみ）
    // 既存リンク削除
    const { error: deleteLinksError } = await supabaseAdmin
      .from("staff_team_links")
      .delete()
      .eq("staff_user_id", userId);

    if (deleteLinksError) {
      console.error("Error deleting staff team links:", deleteLinksError);
      return json(400, {
        error: `Failed to update staff team links: ${deleteLinksError.message}`,
      });
    }

    // staff なら新規作成（teamId があれば）
    if (role === "staff" && teamId) {
      const { error: linkError } = await supabaseAdmin
        .from("staff_team_links")
        .insert({ staff_user_id: userId, team_id: teamId });

      if (linkError) {
        console.error("Error creating staff team link:", linkError);
        return json(400, { error: `Failed to create staff team link: ${linkError.message}` });
      }
    }

    // ※ 注意：ここでは auth.users 側の email は更新していない
    // 同期したいなら下のコメントをON（ただし email 変更時の挙動は運用設計が必要）
    // await supabaseAdmin.auth.admin.updateUserById(userId, { email });

    return json(200, { success: true, message: "User updated successfully" });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return json(500, { error: "Internal server error", details: error?.message ?? String(error) });
  }
});