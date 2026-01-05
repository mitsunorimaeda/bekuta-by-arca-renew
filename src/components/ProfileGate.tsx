// src/components/ProfileGate.tsx
import React, { useEffect, useState } from "react";
import { BekutaSplash } from "./BekutaSplash";
import { supabase } from "../lib/supabase";

type Props = {
  loading: boolean;
  ready: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  timeoutMs?: number; // 例: 12000
};

export function ProfileGate({ loading, ready, onRetry, children, timeoutMs = 12000 }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [loading, timeoutMs]);

  if (ready) return <>{children}</>;

  if (!timedOut) {
    return <BekutaSplash subtitle="マイページを準備しています…" />;
  }

  // ✅ ここで「ずっとぐるぐる」を止める（UI的に）
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="max-w-md w-full p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="text-xl font-bold text-gray-900 dark:text-white">Bekuta</div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          接続が長引いています。通信状況を確認して、再試行してください。
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-semibold"
            onClick={onRetry}
          >
            再試行
          </button>

          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}