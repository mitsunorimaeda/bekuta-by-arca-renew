// supabase/functions/import-inbody-csv/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Row = Record<string, string>;

function normalizePhoneJP(input: string | null | undefined) {
  if (!input) return null;
  const digits = String(input).replace(/[^\d+]/g, "");
  // +81 / 81 を 0始まりに寄せる（ざっくり日本携帯向け）
  const d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("81")) {
    const rest = d.slice(2);
    if (rest.startsWith("0")) return rest;
    return "0" + rest;
  }
  return d.replace(/[^\d]/g, "");
}

function toNum(v: string | null | undefined) {
  if (v == null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * CSVの "Test Date / Time" を Asia/Tokyo 想定で timestamptz にする
 * 例:
 * - 2025-12-27 08:26
 * - 2025/12/27 08:26
 * - 2025-12-27 8:26
 * - 2025-12-27（時刻なし）
 */
function parseTokyoTimestamp(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s0 = String(raw).trim();
    if (!s0) return null;
  
    // ✅ 区切りを "-" に統一（/ や . を許可）
    const s = s0.replace(/[\/\.]/g, "-");
  
    // YYYY-MM-DD HH:mm(:ss)?
    const m =
      s.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
      ) || null;
  
    if (!m) {
      const t = Date.parse(s0);
      if (Number.isFinite(t)) return new Date(t).toISOString();
      return null;
    }
  
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    const HH = String(m[4] ?? "00").padStart(2, "0");
    const MI = String(m[5] ?? "00").padStart(2, "0");
    const SS = String(m[6] ?? "00").padStart(2, "0");
  
    // Asia/Tokyo(+09:00)として固定
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}:${SS}+09:00`;
  }

function datePartFromTokyo(ts: string): string | null {
  // ts が "YYYY-MM-DDT..." なら日付部分を抜く
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})T/);
  return m ? m[1] : null;
}

// シンプルCSVパーサ（ダブルクォート対応の軽量版）
function parseCSV(csvText: string): Row[] {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row: Row = {};
    headers.forEach((h, idx) => (row[h] = vals[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 認証（JWT必須）
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authErr } = await authed.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DB操作はService Role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const csvText: string = body?.csv ?? "";
    const source: string = body?.source ?? "csv";
    const note: string | null = body?.note ?? null;

    if (!csvText || typeof csvText !== "string") {
      return new Response(JSON.stringify({ error: "csv is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = parseCSV(csvText);

    // ヘッダ名（そのままでもOK）
    const H_PHONE = "Mobile Number";
    const H_HEIGHT = "Height";
    const H_DT = "Test Date / Time";
    const H_WEIGHT = "Weight";
    const H_PBF = "PBF (Percent Body Fat)";

    const upserts: any[] = [];
    const rejects: any[] = [];

    for (const r of rows) {
      const phoneRaw = r[H_PHONE];
      const phoneNorm = normalizePhoneJP(phoneRaw);
      const ts = parseTokyoTimestamp(r[H_DT]);
      const measuredAt = ts ? datePartFromTokyo(ts) : null;

      if (!phoneNorm || !ts || !measuredAt) {
        rejects.push({
          reason: "missing phone or datetime",
          phoneRaw,
          testDateTime: r[H_DT],
        });
        continue;
      }

      upserts.push({
        // user_id は後で紐付ける（ここでは null でOK）
        user_id: null,
        phone_number: phoneRaw ? String(phoneRaw) : null,
        phone_number_norm: phoneNorm,
        measured_at_ts: ts,
        measured_at: measuredAt,
        height: toNum(r[H_HEIGHT]),
        weight: toNum(r[H_WEIGHT]),
        body_fat_percent: toNum(r[H_PBF]),
        source,
        note,
        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          inserted_or_updated: 0,
          rejected: rejects.length,
          rejects,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ 本命：phone_number_norm, measured_at_ts で upsert
    const { error: upErr } = await admin
      .from("inbody_records")
      .upsert(upserts, { onConflict: "phone_number_norm,measured_at_ts" });

    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        ok: true,
        inserted_or_updated: upserts.length,
        rejected: rejects.length,
        rejects,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});