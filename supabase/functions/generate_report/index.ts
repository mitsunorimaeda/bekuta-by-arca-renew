/// <reference deno-lint-ignore-file no-explicit-any />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Body = {
  report_history_id?: string;
};

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function nowISO() {
  return new Date().toISOString();
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  console.log(`[generate_report] start requestId=${requestId}`);

  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method Not Allowed" });
    }

    // ==============================
    // ENV
    // ==============================
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ==============================
    // BODY
    // ==============================
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const reportHistoryId = body.report_history_id;
    if (!reportHistoryId) {
      return json(400, { error: "report_history_id is required" });
    }

    // ==============================
    // report_history 取得
    // ==============================
    const { data: history, error: historyErr } = await supabaseAdmin
      .from("report_history")
      .select("*")
      .eq("id", reportHistoryId)
      .single();

    if (historyErr || !history) {
      return json(404, { error: "report_history not found" });
    }

    // ==============================
    // running に更新
    // ==============================
    {
      const { error } = await supabaseAdmin
        .from("report_history")
        .update({
          status: "pending", // running を使わない設計に合わせる
          started_at: nowISO(),
          error_message: null,
        })
        .eq("id", reportHistoryId);

      if (error) {
        return json(500, { error: "Failed to update started status", detail: error.message });
      }
    }

    // ==============================
    // ダミーレポート生成（ここを後で本実装）
    // ==============================
    const reportContent = {
      report_history_id: reportHistoryId,
      report_type: history.report_type,
      parameters: history.parameters,
      generated_at: nowISO(),
    };

    const reportJson = JSON.stringify(reportContent, null, 2);

    // ==============================
    // Storage へアップロード（B案）
    // ==============================
    const bucket = "reports";
    const filePath = `${reportHistoryId}.json`; // ← ★ 直下に置く

    const uploadRes = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, new Blob([reportJson], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
      });

    if (uploadRes.error) {
      await supabaseAdmin.from("report_history").update({
        status: "failed",
        error_message: uploadRes.error.message,
      }).eq("id", reportHistoryId);

      return json(500, { error: "Storage upload failed", detail: uploadRes.error.message });
    }

    // ==============================
    // 署名URL発行
    // ==============================
    const { data: signed, error: signErr } =
      await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7日

    if (signErr) {
      await supabaseAdmin.from("report_history").update({
        status: "failed",
        error_message: signErr.message,
      }).eq("id", reportHistoryId);

      return json(500, { error: "Failed to create signed URL", detail: signErr.message });
    }

    // ==============================
    // completed に更新
    // ==============================
    {
      const { error } = await supabaseAdmin
        .from("report_history")
        .update({
          status: "completed",
          file_path: filePath,          // ★ "<id>.json"
          report_url: signed?.signedUrl ?? null,
          completed_at: nowISO(),
          error_message: null,
        })
        .eq("id", reportHistoryId);

      if (error) {
        return json(500, { error: "Failed to finalize report", detail: error.message });
      }
    }

    const ms = Date.now() - startedAt;

    return json(200, {
      ok: true,
      request_id: requestId,
      report_history_id: reportHistoryId,
      file_path: filePath,
      report_url: signed?.signedUrl ?? null,
      ms,
    });

  } catch (e: any) {
    console.error("[generate_report] fatal", e);
    return json(500, { error: e?.message ?? String(e) });
  }
});