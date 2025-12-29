// src/lib/pushClient.ts
import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  return reg;
}

/**
 * Push購読を返す（既存があれば再利用）
 */
export async function subscribePush(publicVapidKey: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push not supported");
  }

  // ready は register 後に安定
  const reg = await navigator.serviceWorker.ready;

  // 既存購読があれば再利用（重要）
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
  });

  return sub;
}

/**
 * UIボタンから呼ぶ用：購読を取得してDBに保存する（= Push有効化）
 * - 既存購読があっても、DBに必ずupsertして整合性を取る（重要）
 */
export async function enablePushForCurrentUser(publicVapidKey: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  // SWが未登録でもreadyまで行けるよう、先に登録
  await registerServiceWorker();

  const sub = await subscribePush(publicVapidKey);
  const json = sub.toJSON();

  const payload = {
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    user_agent: navigator.userAgent,
  };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "user_id,endpoint" });

  if (error) throw error;

  return sub;
}

/**
 * Push無効化（= 購読解除 + DB削除）
 * - まずブラウザ側のsubscriptionを解除
 * - その後DB側を削除
 */
export async function disablePushForCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  // ブラウザ側の購読解除
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await sub.unsubscribe();
      } catch (e) {
        // 解除に失敗してもDBは消したいので握りつぶす（ログだけ）
        console.warn("unsubscribe failed:", e);
      }
    }
  }

  // DB側の購読削除（ユーザーの購読を削除）
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;

  return true;
}

/**
 * UIの初期表示用：このユーザーがpush有効か判定
 */
export async function getPushEnabledForUser(userId: string) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}   