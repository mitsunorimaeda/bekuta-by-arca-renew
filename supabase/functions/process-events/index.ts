// supabase/functions/process-events/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type EventRow = {
  id: string;
  user_id: string;
  event_type: string;
  payload: any;
  created_at: string;
  processed_at: string | null;
};

async function markProcessed(eventId: string, ok: boolean, errorMsg?: string) {
  await admin
    .from("events")
    .update({
      processed_at: new Date().toISOString(),
      processed_by: "edge:process-events",
      process_error: ok ? null : (errorMsg ?? "unknown"),
    })
    .eq("id", eventId);
}

// 例：とりあえず「練習記録を初めて作った」バッジだけ繋ぐ
async function handleTrainingCreated(ev: EventRow) {
  // training_records の件数を見て初回判定（※DBに合わせてテーブル名確認）
  const { count, error } = await admin
    .from("training_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ev.user_id);

  if (error) throw error;

  if ((count ?? 0) === 1) {
    // 初回ならバッジ付与（あなたの badges.name に合わせて名称を変更）
    const { error: rpcErr } = await admin.rpc("earn_badge", {
      p_user_id: ev.user_id,
      p_badge_name: "ブロンズ到達", // ←まずここを“確実に存在するバッジ名”に
      p_metadata: {
        from_event: ev.id,
        payload: ev.payload,
      },
    });

    // 既に付与済み（unique制約）でも “エラーにしない” 実装にしたいなら
    // RPC側で例外を握る or ここで rpcErr.code を見て握る
    if (rpcErr) throw rpcErr;
  }
}

Deno.serve(async (req) => {
  try {
    // 任意：簡単な保護（Bearer 必須に）
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 1回で処理する件数（多すぎるとタイムアウトしやすい）
    const LIMIT = 50;

    const { data: events, error } = await admin
      .from("events")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(LIMIT);

    if (error) throw error;

    for (const ev of (events ?? []) as EventRow[]) {
      try {
        if (ev.event_type === "training_record_created") {
          await handleTrainingCreated(ev);
        }
        // 他の event_type はここに追加していく
        await markProcessed(ev.id, true);
      } catch (e) {
        console.warn("[process-events] failed:", ev.id, e);
        await markProcessed(ev.id, false, e?.message ?? String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (events ?? []).length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[process-events] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});// supabase/functions/process-events/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type EventRow = {
  id: string;
  user_id: string;
  event_type: string;
  payload: any;
  created_at: string;
  processed_at: string | null;
};

async function markProcessed(eventId: string, ok: boolean, errorMsg?: string) {
  await admin
    .from("events")
    .update({
      processed_at: new Date().toISOString(),
      processed_by: "edge:process-events",
      process_error: ok ? null : (errorMsg ?? "unknown"),
    })
    .eq("id", eventId);
}

// 例：とりあえず「練習記録を初めて作った」バッジだけ繋ぐ
async function handleTrainingCreated(ev: EventRow) {
  // training_records の件数を見て初回判定（※DBに合わせてテーブル名確認）
  const { count, error } = await admin
    .from("training_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ev.user_id);

  if (error) throw error;

  if ((count ?? 0) === 1) {
    // 初回ならバッジ付与（あなたの badges.name に合わせて名称を変更）
    const { error: rpcErr } = await admin.rpc("earn_badge", {
      p_user_id: ev.user_id,
      p_badge_name: "ブロンズ到達", // ←まずここを“確実に存在するバッジ名”に
      p_metadata: {
        from_event: ev.id,
        payload: ev.payload,
      },
    });

    // 既に付与済み（unique制約）でも “エラーにしない” 実装にしたいなら
    // RPC側で例外を握る or ここで rpcErr.code を見て握る
    if (rpcErr) throw rpcErr;
  }
}

Deno.serve(async (req) => {
  try {
    // 任意：簡単な保護（Bearer 必須に）
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 1回で処理する件数（多すぎるとタイムアウトしやすい）
    const LIMIT = 50;

    const { data: events, error } = await admin
      .from("events")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(LIMIT);

    if (error) throw error;

    for (const ev of (events ?? []) as EventRow[]) {
      try {
        if (ev.event_type === "training_record_created") {
          await handleTrainingCreated(ev);
        }
        // 他の event_type はここに追加していく
        await markProcessed(ev.id, true);
      } catch (e) {
        console.warn("[process-events] failed:", ev.id, e);
        await markProcessed(ev.id, false, e?.message ?? String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (events ?? []).length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[process-events] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});