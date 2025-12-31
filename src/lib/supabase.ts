// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ Realtime ON/OFF
const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[supabase] URL or ANON KEY is missing");
}

const g = globalThis as any;

export const supabase =
  g.__bekuta_supabase ??
  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  (g.__bekuta_supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },

    // ✅ ここで Realtime を制御
    realtime: ENABLE_REALTIME
      ? {}
      : {
          params: {
            eventsPerSecond: 0,
          },
        },
  }));

/**
 * ✅ PWA/モバイルで起きやすい「壊れたrefresh_token」を自動回復する
 * - Invalid Refresh Token が出たら signOut + localStorage 掃除
 */
export async function recoverFromInvalidRefreshToken(err: unknown) {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as any).message)
      : String(err ?? "");

  if (
    msg.includes("Invalid Refresh Token") ||
    msg.includes("Refresh Token Not Found") ||
    msg.includes("refresh_token")
  ) {
    try {
      await supabase.auth.signOut();
    } catch (_) {}

    try {
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          window.localStorage.removeItem(k);
        }
      }
    } catch (_) {}

    window.location.reload();
  }
}

export type { Database } from "./database.types";