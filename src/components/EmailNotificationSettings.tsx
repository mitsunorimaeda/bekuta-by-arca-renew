// src/components/EmailNotificationSettings.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Mail, Bell, Shield, Calendar, CheckCircle, AlertCircle, Save } from "lucide-react";
import {
  registerServiceWorker,
  enablePushForCurrentUser,
  disablePushForCurrentUser,
} from "../lib/pushClient";

interface EmailNotificationSettingsProps {
  userId: string;
  userEmail: string;
}

interface NotificationPreferences {
  alerts: boolean;
  password_reset: boolean;
  weekly_summary: boolean;
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export function EmailNotificationSettings({ userId, userEmail }: EmailNotificationSettingsProps) {
  // Email preferences (users.email_notifications)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    alerts: true,
    password_reset: true,
    weekly_summary: false,
  });

  // Push preferences (push_subscriptions)
  const [pushReady, setPushReady] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadPreferences(), initPush()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // --- Load / Save email notification preferences ---
  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("email_notifications")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // invitations は削除方針なので取り込まない（古いデータがあっても無視）
      const incoming = (data?.email_notifications ?? {}) as Partial<NotificationPreferences>;
      setPreferences((prev) => ({
        ...prev,
        ...incoming,
      }));
    } catch (error) {
      console.error("Error loading email preferences:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("users")
        .update({ email_notifications: preferences })
        .eq("id", userId);

      if (error) throw error;

      setMessage({ type: "success", text: "メール通知設定を保存しました" });
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      setMessage({ type: "error", text: error.message || "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Push init / toggle ---
  const initPush = async () => {
    try {
      // SW登録（許可ダイアログは出ない）
      const reg = await registerServiceWorker();
      setPushReady(!!reg);

      // すでに購読がDBにあるか確認（＝Push ON扱い）
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
      // Push自体は使えない環境もあるので、ここでは強制エラー表示しない
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
        // ON：ここで許可ダイアログが出る
        await registerServiceWorker();
        await enablePushForCurrentUser(PUBLIC_VAPID_KEY);

        // DB反映（確実にON表示にする）
        setPushEnabled(true);
        setMessage({ type: "success", text: "プッシュ通知をONにしました" });
      } else {
        // OFF：購読解除＋DB削除
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
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-3">
        <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">通知設定</h2>
      </div>

      {/* Email info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>メールアドレス:</strong> {userEmail}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              メール通知はこのアドレスに送信されます
            </p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6 transition-colors">
        {/* Push notifications */}
        <div className="flex items-start space-x-4">
          <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">プッシュ通知</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  アプリを開いていない時も、必要なときだけそっと声をかけます
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

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        {/* Email: alerts */}
        <div className="flex items-start space-x-4">
          <Bell className="w-6 h-6 text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">アラート通知（メール）</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  高リスクのACWR値や怪我の予測アラートをメールで受信
                </p>
              </div>
              <button
                onClick={() => handleToggle("alerts")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.alerts ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.alerts ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        {/* Email: password reset */}
        <div className="flex items-start space-x-4">
          <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">パスワードリセット通知（メール）</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  パスワードがリセットされた際のセキュリティ通知
                </p>
              </div>
              <button
                onClick={() => handleToggle("password_reset")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.password_reset ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.password_reset ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        {/* Email: weekly summary */}
        <div className="flex items-start space-x-4">
          <Calendar className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">週次サマリー（メール）</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  毎週月曜日に先週の状況をまとめたレポートを受信
                </p>
              </div>
              <button
                onClick={() => handleToggle("weekly_summary")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.weekly_summary ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.weekly_summary ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
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

      {/* save button - email preferences only */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>保存中...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>メール設定を保存</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>注意:</strong> セキュリティに関する重要な通知（パスワードリセット等）は、設定に関わらず送信される場合があります。
        </p>
      </div>
    </div>
  );
}