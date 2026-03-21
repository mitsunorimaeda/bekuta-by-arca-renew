import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function
 * 毎日 11:00 UTC (= 20:00 JST) にチェックインリマインダーを送信
 *
 * Supabase Edge Function (send-checkin-reminder) を呼び出す。
 */
export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Missing env vars", { status: 500 });
  }

  const url = `${supabaseUrl}/functions/v1/send-checkin-reminder`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    console.log("Checkin reminder result:", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("Failed to trigger checkin reminder:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: "0 11 * * *", // 11:00 UTC = 20:00 JST
};
