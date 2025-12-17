import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

serve(async (req) => {
  const started = Date.now();
  console.log("[alert] start", { method: req.method });

  try {
    // ✅ HEAD/GETは即返す（監視・先読み対策）
    if (req.method === "HEAD") return new Response(null, { status: 200 });
    if (req.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // ✅ 環境変数不足でハングしないよう即エラー
    if (!url || !serviceKey) {
      console.error("[alert] missing supabase env", { hasUrl: !!url, hasServiceKey: !!serviceKey });
      return new Response(JSON.stringify({ error: "missing supabase env" }), { status: 500 });
    }
    if (!resendKey) {
      console.error("[alert] missing resend key");
      return new Response(JSON.stringify({ error: "missing resend key" }), { status: 500 });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    console.log("[alert] before db");
    // ✅ DBが詰まるならここで分かる
    const { data, error } = await withTimeout(
      supabase.from("users").select("id").limit(1),
      8000,
      "db_select_users"
    );
    if (error) throw error;
    console.log("[alert] db ok", { rows: data?.length ?? 0 });

    // ✅ ここから先：Resend送信も必ず timeout をかける
    // 例）await withTimeout(fetch(...), 8000, "resend_send")

    return new Response(JSON.stringify({ ok: true, ms: Date.now() - started }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[alert] error", e);
    return new Response(JSON.stringify({ ok: false, ms: Date.now() - started, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});