// src/components/TeamAchievementNotification.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Trophy, X, Users, Award, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import confetti from "canvas-confetti";
import { useRealtimeHub } from "../hooks/useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";
const POLL_MS = 120_000; // 120秒

interface TeamAchievement {
  id: string;
  team_id: string;
  achievement_type: string;
  title: string;
  description: string | null;
  achieved_at: string | null;
  metadata: any;
  celebrated: boolean;
}

interface TeamAchievementNotificationRow {
  id: string;
  team_id: string;
  user_id: string;
  achievement_id: string;
  is_read: boolean;
  created_at: string;
  achievement: TeamAchievement | null;
}

interface Props {
  userId: string;
}

export function TeamAchievementNotification({ userId }: Props) {
  const { state, registerPollJob } = useRealtimeHub();

  const [notifications, setNotifications] = useState<TeamAchievementNotificationRow[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] =
    useState<TeamAchievementNotificationRow | null>(null);

  // ✅ hookインスタンス固有（job key / channel名衝突回避）
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  // ✅ WS channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ✅ Poll unregister
  const unregisterPollRef = useRef<null | (() => void)>(null);

  // ✅ realtime が死んだら poll fallback に落とす
  const [realtimeFailed, setRealtimeFailed] = useState(false);

  const removeChannelSafe = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;

    try {
      ch.unsubscribe?.();
    } catch (_) {}

    try {
      supabase.removeChannel(ch);
    } catch (_) {}

    channelRef.current = null;
  }, []);

  const loadUnreadNotifications = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("team_achievement_notifications")
      .select(
        `
        id, team_id, user_id, achievement_id, is_read, created_at,
        achievement:team_achievements (
          id, team_id, achievement_type, title, description, achieved_at, metadata, celebrated
        )
      `
      )
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[team_achievement_notifications] load error:", error);
      return;
    }
    if (!data) return;

    // achievement null を除外（RLS/欠損でも落ちない）
    const safe = (data as any[]).filter((n) => n.achievement);
    setNotifications(safe as TeamAchievementNotificationRow[]);
  }, [userId]);

  // ✅ visible/online に戻ったタイミングで 1回同期（Hubのstateに乗る）
  useEffect(() => {
    if (!userId) return;
    if (!state.canRun) return;
    void loadUnreadNotifications();
  }, [userId, state.canRun, loadUnreadNotifications]);

  // ✅ Realtime：Hub許可のときだけ接続（＝visible & online）
  useEffect(() => {
    // 先に掃除
    removeChannelSafe();

    if (!userId) return;

    const canUseRealtime =
      ENABLE_REALTIME && state.canRealtime && !realtimeFailed;

    if (!canUseRealtime) return;

    const channel = supabase
      .channel(`team-achievements:${userId}:${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_achievement_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadNotifications();
        }
      );

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[TeamAchievementNotification] rt", status);

      if (status === "SUBSCRIBED") {
        void loadUnreadNotifications();
      }

      // ✅ 失敗したら poll fallback に切替
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[TeamAchievementNotification] realtime issue:", status);
        setRealtimeFailed(true);
        removeChannelSafe();
      }
    });

    return () => {
      removeChannelSafe();
    };
  }, [userId, state.canRealtime, realtimeFailed, loadUnreadNotifications, removeChannelSafe]);

  // ✅ Polling：Realtimeが使えない時だけ Hub に登録（中央制御）
  useEffect(() => {
    // 前回job解除
    if (unregisterPollRef.current) {
      unregisterPollRef.current();
      unregisterPollRef.current = null;
    }

    if (!userId) return;

    // Realtimeが完全OFF、または Realtimeが死んだときだけ poll fallback
    const pollEnabled = !ENABLE_REALTIME || realtimeFailed;

    if (!pollEnabled) return;

    const key = `team_achievements:${userId}:${instanceIdRef.current}`;

    const unregister = registerPollJob({
      key,
      intervalMs: POLL_MS,
      run: async () => {
        await loadUnreadNotifications();
      },
      enabled: true,
      requireVisible: true, // ✅ 背景は止める
      requireOnline: true,  // ✅ offline は止める
      immediate: true,      // ✅ poll fallbackに入った瞬間は即同期
    });

    unregisterPollRef.current = unregister;

    return () => {
      if (unregisterPollRef.current) {
        unregisterPollRef.current();
        unregisterPollRef.current = null;
      }
    };
  }, [userId, realtimeFailed, registerPollJob, loadUnreadNotifications]);

  // ✅ Realtime が復活できる状態に戻ったら、次回の可視/オンラインで再挑戦
  useEffect(() => {
    if (!ENABLE_REALTIME) return;
    if (!userId) return;
    if (!state.canRealtime) return;

    // “失敗フラグ”は、visible&onlineになったタイミングで一旦解除して再接続を許可
    if (realtimeFailed) {
      setRealtimeFailed(false);
    }
  }, [userId, state.canRealtime, realtimeFailed]);

  useEffect(() => {
    if (notifications.length > 0 && !showNotification) {
      setCurrentNotification(notifications[0]);
      setShowNotification(true);
      triggerConfetti();
    }
  }, [notifications, showNotification]);

  const triggerConfetti = () => {
    const duration = 2500;
    const end = Date.now() + duration;
    const defaults = { startVelocity: 25, spread: 360, ticks: 60, zIndex: 9999 };

    const interval: any = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.2, y: 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.8, y: 0.2 } });
    }, 200);
  };

  const handleClose = async () => {
    if (!currentNotification) return;

    const { error } = await supabase.rpc("mark_team_notification_read", {
      p_notification_id: currentNotification.id,
    });
    if (error) console.error("[mark_team_notification_read] error:", error);

    setShowNotification(false);
    setNotifications((prev) => prev.filter((n) => n.id !== currentNotification.id));
    setCurrentNotification(null);
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "team_streak":
      case "streak_7":
        return Users;
      case "team_personal_best":
      case "pb":
        return Award;
      case "team_acwr_safe":
        return TrendingUp;
      case "team_goals_complete":
      case "goal":
        return Trophy;
      default:
        return Trophy;
    }
  };

  if (!showNotification || !currentNotification) return null;

  const achievement = currentNotification.achievement;
  if (!achievement) return null;

  const Icon = getAchievementIcon(achievement.achievement_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-2xl shadow-2xl max-w-md w-full p-8 border-4 border-yellow-400 dark:border-yellow-600 animate-bounce-in">
        <div className="flex justify-end mb-2">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-400 dark:bg-yellow-600 rounded-full mb-4 animate-pulse">
            <Icon className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">チーム達成！</h2>

          <div className="mb-4">
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
              {achievement.title}
            </h3>
            {achievement.description ? (
              <p className="text-gray-700 dark:text-gray-300">{achievement.description}</p>
            ) : null}
          </div>

          <button
            onClick={handleClose}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
          >
            おめでとう！
          </button>
        </div>
      </div>
    </div>
  );
}