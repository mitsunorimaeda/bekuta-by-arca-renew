/**
 * notify-incomplete-records
 *
 * Scheduled Edge Function — called by pg_cron at:
 *   - 20:00 JST  (11:00 UTC)  → remind users who haven't recorded training today
 *   - 22:00 JST  (13:00 UTC)  → remind users with ANY incomplete records
 *
 * pg_cron calls this via a pg_net HTTP request:
 *   SELECT net.http_post(
 *     url := '<SUPABASE_URL>/functions/v1/notify-incomplete-records',
 *     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}',
 *     body := '{"trigger": "20:00"}'
 *   );
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TriggerType = "20:00" | "22:00";

interface NotificationTarget {
  user_id: string;
  form: string;
  title: string;
  body: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { trigger } = (await req.json().catch(() => ({}))) as { trigger?: TriggerType };

    // 日本時間の今日の日付を取得
    const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayJST = nowJST.toISOString().split("T")[0];

    // push_subscriptionsがあるユーザー一覧を取得
    const { data: subscribers, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .order("user_id");

    if (subError || !subscribers?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "no subscribers" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const userIds = [...new Set(subscribers.map((s: { user_id: string }) => s.user_id))];

    // 各ユーザーの今日の記録状況を確認
    const [trainingRows, sleepRows, conditionRows, weightRows] = await Promise.all([
      supabase.from("training_records").select("user_id").eq("date", todayJST).in("user_id", userIds),
      supabase.from("sleep_records").select("user_id").eq("date", todayJST).in("user_id", userIds),
      supabase.from("motivation_records").select("user_id").eq("date", todayJST).in("user_id", userIds),
      supabase.from("weight_records").select("user_id").eq("date", todayJST).in("user_id", userIds),
    ]);

    const doneTraining  = new Set((trainingRows.data ?? []).map((r: { user_id: string }) => r.user_id));
    const doneSleep     = new Set((sleepRows.data ?? []).map((r: { user_id: string }) => r.user_id));
    const doneCondition = new Set((conditionRows.data ?? []).map((r: { user_id: string }) => r.user_id));
    const doneWeight    = new Set((weightRows.data ?? []).map((r: { user_id: string }) => r.user_id));

    const targets: NotificationTarget[] = [];

    for (const userId of userIds) {
      const hasTrain = doneTraining.has(userId);
      const hasSleep = doneSleep.has(userId);
      const hasCond  = doneCondition.has(userId);
      const hasWeight = doneWeight.has(userId);
      const allDone  = hasTrain && hasSleep && hasCond && hasWeight;

      // 全完了なら通知しない
      if (allDone) continue;

      if (trigger === "20:00") {
        // 夕方トリガー: 練習未記録のユーザーにのみ通知
        if (!hasTrain) {
          targets.push({
            user_id: userId,
            form: "training",
            title: "練習を記録しよう 🏃",
            body: "今日の練習強度と時間を記録しよう。1分もかからないよ！",
          });
        }
      } else if (trigger === "22:00") {
        // 夜トリガー: 未完了の最初の項目を通知
        if (!hasCond) {
          targets.push({
            user_id: userId,
            form: "condition",
            title: "今日の体調を記録しよう 💪",
            body: "あと少しで今日が終わる。体調の記録だけ残しておこう！",
          });
        } else if (!hasTrain) {
          targets.push({
            user_id: userId,
            form: "training",
            title: "練習記録が残ってるよ 📝",
            body: "今日の練習を忘れずに記録しよう。",
          });
        } else if (!hasSleep) {
          targets.push({
            user_id: userId,
            form: "sleep",
            title: "昨夜の睡眠を記録しよう 😴",
            body: "睡眠の記録がまだだよ。記録してから今夜も良い睡眠を！",
          });
        } else if (!hasWeight) {
          targets.push({
            user_id: userId,
            form: "weight",
            title: "体重の記録を忘れずに ⚖️",
            body: "今日の体重をまだ記録していないよ！",
          });
        }
      } else {
        // デフォルト（テスト用など）: 何か未記録のものを通知
        const firstMissing = !hasTrain ? "training"
          : !hasSleep ? "sleep"
          : !hasCond  ? "condition"
          : "weight";
        targets.push({
          user_id: userId,
          form: firstMissing,
          title: "今日の記録を完成させよう 🎯",
          body: "まだ記録が残っているよ。今すぐ完成させよう！",
        });
      }
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "all users done" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // 各ターゲットに send-web-push を呼び出す
    const appUrl = Deno.env.get("APP_URL") || "https://bekuta-v2.netlify.app";
    let sent = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: target.user_id,
            title: target.title,
            body: target.body,
            url: `${appUrl}/athlete?form=${target.form}`,
          }),
        });
        const result = await res.json();
        sent += result.sent ?? 0;
        if (result.errors?.length) errors.push(...result.errors);
      } catch (e: unknown) {
        errors.push(`Failed for ${target.user_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, trigger, targets: targets.length, sent, errors }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
