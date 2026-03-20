// src/components/NotificationSettings.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Bell, CheckCircle, AlertCircle } from "lucide-react";
import {
  registerServiceWorker,
  enablePushForCurrentUser,
  disablePushForCurrentUser,
} from "../lib/pushClient";

interface NotificationSettingsProps {
  userId: string;
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export function EmailNotificationSettings({ userId }: NotificationSettingsProps) {
  const [pushReady, setPushReady] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    initPush().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const initPush = async () => {
    try {
      const reg = await registerServiceWorker();
      setPushReady(!!reg);

      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPushEnabled(!!data);
    } catch (e) {
      console.error("Error init push:", e);
      setPushReady(false);
    }
  };

  const handlePushToggle = async () => {
    setPushBusy(true);
    setMessage(null);

    try {
      if (!PUBLIC_VAPID_KEY) {
        throw new Error("VITE_VAPID_PUBLIC_KEY が設定されていません");
      }

      if (!pushEnabled) {
        await registerServiceWorker();
        await enablePushForCurrentUser(PUBLIC_VAPID_KEY);
        setPushEnabled(true);
        setMessage({ type: "success", text: "プッシュ通知をONにしました" });
      } else {
        await disablePushForCurrentUser();
        setPushEnabled(false);
        setMessage({ type: "success", text: "プッシュ通知をOFFにしました" });
      }
    } catch (error: any) {
      console.error("Push toggle error:", error);
      setMessage({ type: "error", text: error.message || "プッシュ通知の設定に失敗しました" });
    } finally {
      setPushBusy(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">通知設定</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4 transition-colors">
        {/* Push notifications */}
        <div className="flex items-start space-x-4">
          <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">プッシュ通知</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  チェックイン忘れのリマインダーやコーチからのメッセージを受け取れます
                </p>
              </div>

              <button
                onClick={handlePushToggle}
                disabled={!pushReady || pushBusy}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  pushEnabled ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                } ${(!pushReady || pushBusy) ? "opacity-50 cursor-not-allowed" : ""}`}
                title={!pushReady ? "この端末ではプッシュ通知を利用できない可能性があります" : ""}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pushEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ※ iPhoneは「ホーム画面に追加」したBekutaからONにしてください
            </p>
          </div>
        </div>
      </div>

      {/* message */}
      {message && (
        <div
          className={`flex items-center space-x-3 p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          } transition-colors`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}
    </div>
  );
}
