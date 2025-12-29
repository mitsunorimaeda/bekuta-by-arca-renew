import dotenv from "dotenv";
dotenv.config({ path: ".env.push.local" });

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@bekuta.app";

const USER_ID = process.env.USER_ID;

// ✅ 追加：ENVの見え方を確認
console.log("ENV FILE LOADED (.env.push.local)");
console.log("SUPABASE_URL?", !!SUPABASE_URL, SUPABASE_URL?.slice(0, 30));
console.log("SERVICE_ROLE_KEY?", !!SERVICE_ROLE_KEY, SERVICE_ROLE_KEY?.slice(0, 10));
console.log("VAPID_PUBLIC_KEY?", !!VAPID_PUBLIC_KEY, VAPID_PUBLIC_KEY?.slice(0, 10));
console.log("VAPID_PRIVATE_KEY?", !!VAPID_PRIVATE_KEY, VAPID_PRIVATE_KEY?.slice(0, 10));
console.log("VAPID_SUBJECT?", !!process.env.VAPID_SUBJECT, VAPID_SUBJECT);
console.log("USER_ID?", !!USER_ID, USER_ID?.slice(0, 10));
console.log("ENV KEYS", Object.keys(process.env).filter(k => k.includes("VAPID") || k.includes("SUPABASE") || k === "USER_ID"));

// ここから通常処理
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing supabase env");
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Missing VAPID env");
if (!USER_ID) throw new Error("Missing USER_ID");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const { data: subs, error } = await supabase
  .from("push_subscriptions")
  .select("endpoint,p256dh,auth")
  .eq("user_id", USER_ID);

if (error) throw error;
if (!subs?.length) throw new Error("No subscriptions found");

const payload = JSON.stringify({
  title: "Bekuta",
  body: "夜の振り返り、30秒だけ。いける？",
  url: "/reflection",
});

for (const s of subs) {
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload
    );
    console.log("OK", s.endpoint.slice(0, 40) + "...");
  } catch (e) {
    console.log("FAIL", e?.statusCode || e?.message);
  }
}

console.log("sent");