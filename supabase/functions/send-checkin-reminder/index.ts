import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendWebPush } from "https://deno.land/x/web_push/mod.ts";

/**
 * チェックイン未提出リマインダー
 *
 * 当日（JST）にtraining_recordsが無い選手のうち、
 * Push通知を登録済みの選手にリマインダーを送信する。
 *
 * 外部スケジューラー（Netlify Scheduled Function等）から
 * 毎日20:00 JSTに呼び出される想定。
 */
Deno.serve(async (req) => {
  // 簡易認証: Authorization ヘッダーでservice_role_keyを確認
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || !authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@bekuta.app";

  const supabase = createClient(supabaseUrl, serviceKey);

  // 今日の日付（JST = UTC+9）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(now.getTime() + jstOffset);
  const todayJST = jstDate.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Push登録済みの全選手を取得
  const { data: pushUsers, error: pushError } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (pushError) {
    return new Response(JSON.stringify({ ok: false, error: pushError.message }), { status: 500 });
  }
  if (!pushUsers || pushUsers.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "no push users", sent: 0 }));
  }

  // ユニークなユーザーIDを抽出
  const userIdSet = new Set(pushUsers.map((p: any) => p.user_id));
  const userIds = Array.from(userIdSet) as string[];

  // これらのユーザーがアスリートかつアクティブか確認
  const { data: athletes, error: athError } = await supabase
    .from("users")
    .select("id")
    .in("id", userIds)
    .eq("role", "athlete")
    .eq("is_active", true);

  if (athError) {
    return new Response(JSON.stringify({ ok: false, error: athError.message }), { status: 500 });
  }
  if (!athletes || athletes.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "no active athletes with push", sent: 0 }));
  }

  const athleteIds = athletes.map((a: any) => a.id);

  // 今日チェックイン済みの選手を除外
  const { data: checkedIn, error: trError } = await supabase
    .from("training_records")
    .select("user_id")
    .in("user_id", athleteIds)
    .eq("date", todayJST);

  if (trError) {
    return new Response(JSON.stringify({ ok: false, error: trError.message }), { status: 500 });
  }

  const checkedInIds = new Set((checkedIn ?? []).map((r: any) => r.user_id));
  const targetIds = athleteIds.filter((id: string) => !checkedInIds.has(id));

  if (targetIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "all athletes checked in", sent: 0 }));
  }

  // 対象選手のPushサブスクリプションを取得してプッシュ送信
  const payload = JSON.stringify({
    title: "コンディション記録",
    body: "今日のコンディションを記録しましょう 💪",
    url: "/",
  });

  let sent = 0;
  let failed = 0;

  for (const userId of targetIds) {
    const userSubs = pushUsers.filter((p: any) => p.user_id === userId);
    for (const s of userSubs) {
      try {
        await sendWebPush({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
          vapidPublicKey: VAPID_PUBLIC_KEY,
          vapidPrivateKey: VAPID_PRIVATE_KEY,
          subject: VAPID_SUBJECT,
          payload,
        });
        sent++;
      } catch {
        failed++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      today: todayJST,
      target_athletes: targetIds.length,
      sent,
      failed,
    }),
    { headers: { "content-type": "application/json" } }
  );
});
