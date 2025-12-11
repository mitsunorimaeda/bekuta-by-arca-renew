// 先頭付近
declare const Deno: any;
// supabase/functions/alert-daily-summary/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@3.2.0";
import {
  calculateACWRSeries,
  MIN_DAYS_FOR_ACWR,
  TrainingRecord,
} from "./_acwr.ts";
import {
  buildDailySummaryEmail,
  AthleteRiskSummary,
  RiskLevel,
} from "./_alerts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const resend = new Resend(RESEND_API_KEY);

// JSTの日付（YYYY-MM-DD）を返すヘルパー
function formatJstDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

serve(async (_req) => {
  try {
    const now = new Date();
    const todayJst = formatJstDate(now);

    // ① スタッフ（コーチ）ユーザーを取得
    const { data: staffUsers, error: staffError } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("role", "staff");

    if (staffError) throw staffError;

    if (!staffUsers || staffUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No staff users found" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const resultSummary: Record<string, unknown> = {};

    // スタッフごとに処理
    for (const staff of staffUsers) {
      if (!staff.email) continue;

      // ② 担当チームを取得
      const { data: teamLinks, error: teamError } = await supabase
        .from("staff_team_links")
        .select("team_id, teams ( id, name )")
        .eq("staff_user_id", staff.id);

      if (teamError) throw teamError;
      if (!teamLinks || teamLinks.length === 0) continue;

      const teamIds = teamLinks.map((l: any) => l.team_id);
      const teamMap = new Map<string, string>();
      for (const link of teamLinks as any[]) {
        if (link.teams) {
          teamMap.set(link.teams.id, link.teams.name);
        }
      }

      // ③ チームの選手を取得
      const { data: athletes, error: athleteError } = await supabase
        .from("users")
        .select("id, name, team_id")
        .in("team_id", teamIds)
        .eq("role", "athlete");

      if (athleteError) throw athleteError;
      if (!athletes || athletes.length === 0) continue;

      // ④ 各選手のACWR & リスク判定
      const highRiskAthletes: AthleteRiskSummary[] = [];
      const cautionAthletes: AthleteRiskSummary[] = [];

      // 過去35日間のデータを取得するための日付
      const startDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
      const startDateStr = formatJstDate(startDate);

      for (const athlete of athletes as any[]) {
        const { data: trainingRecords, error: trError } = await supabase
          .from("training_records")
          .select("user_id, date, rpe, duration_min, load")
          .eq("user_id", athlete.id)
          .gte("date", startDateStr)
          .order("date", { ascending: true });

        if (trError) throw trError;
        if (!trainingRecords || trainingRecords.length === 0) continue;

        const acwrSeries = calculateACWRSeries(
          trainingRecords as TrainingRecord[],
        );

        if (acwrSeries.length === 0) continue;

        const latest = acwrSeries[acwrSeries.length - 1];

        // 21日未満はまだ分析対象外
        if (!latest.hasEnoughDays) continue;

        let riskLevel: RiskLevel = "good";
        if (latest.acwr > 1.5) riskLevel = "high";
        else if (latest.acwr >= 1.3) riskLevel = "caution";
        else if (latest.acwr < 0.8) riskLevel = "low";

        const teamName = athlete.team_id
          ? teamMap.get(athlete.team_id) ?? "不明チーム"
          : "不明チーム";

        const summaryRow: AthleteRiskSummary = {
          athleteName: athlete.name ?? "名前未設定",
          teamName,
          latestAcwr: Number(latest.acwr.toFixed(2)),
          riskLevel,
          lastTrainingDate: latest.lastTrainingDate,
          daysSinceLastTraining: latest.daysSinceLastTraining,
        };

        if (riskLevel === "high") {
          highRiskAthletes.push(summaryRow);
        } else if (riskLevel === "caution") {
          cautionAthletes.push(summaryRow);
        }
      }

      // 高リスク or 注意レベルが誰もいなければ、そのスタッフへのメールはスキップ
      if (highRiskAthletes.length === 0 && cautionAthletes.length === 0) {
        continue;
      }

      // ⑤ メール本文生成
      const { subject, html, text } = buildDailySummaryEmail({
        staffName: staff.name ?? "コーチ",
        date: todayJst,
        highRiskAthletes,
        cautionAthletes,
      });

      // ⑥ Resendでメール送信
      const sendResult = await resend.emails.send({
        from: "ARCA ベクタ noreply@arca.fit",
        to: staff.email,
        subject,
        html,
        text,
      });

      resultSummary[staff.email] = {
        highRiskCount: highRiskAthletes.length,
        cautionCount: cautionAthletes.length,
        sendResult,
      };
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        date: todayJst,
        resultSummary,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("alert-daily-summary error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});