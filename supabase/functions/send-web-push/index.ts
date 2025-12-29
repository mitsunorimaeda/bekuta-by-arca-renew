import { createClient } from "jsr:@supabase/supabase-js@2";

// 例：Deno対応web-push（Qiitaで紹介されてるやつ）
import { sendWebPush } from "https://deno.land/x/web_push/mod.ts";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@bekuta.app";

  const supabase = createClient(supabaseUrl, serviceKey);

  const { user_id, title, body, url } = await req.json();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user_id);

  if (error) return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
  if (!subs || subs.length === 0) return new Response(JSON.stringify({ ok: false, error: "no subscriptions" }), { status: 404 });

  const payload = JSON.stringify({ title, body, url });

  // 全端末へ送る（最初はこれでOK）
  const results = [];
  for (const s of subs) {
    const r = await sendWebPush({
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      vapidPublicKey: VAPID_PUBLIC_KEY,
      vapidPrivateKey: VAPID_PRIVATE_KEY,
      subject: VAPID_SUBJECT,
      payload,
    });
    results.push(r);
  }

  return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" }});
});