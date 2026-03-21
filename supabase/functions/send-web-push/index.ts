import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@bekuta.app";

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, title, body, url } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "no subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title: title || "Bekuta",
      body: body || "",
      url: url || "/",
    });

    let sent = 0;
    const errors: string[] = [];

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.p256dh,
              auth: s.auth,
            },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        // 410 Gone = subscription expired, clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
          errors.push(`Removed expired subscription ${s.id}`);
        } else {
          errors.push(`Failed to send to ${s.id}: ${err.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, total: subs.length, errors }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
