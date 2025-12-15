import React, { useEffect, useState, useRef } from "react";
import { Trophy, X, Users, Award, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import confetti from "canvas-confetti";

interface TeamAchievement {
  id: string;
  team_id: string;
  achievement_type: string;
  title: string;
  description: string;
  achieved_at: string;
  metadata: any;
  celebrated: boolean;
}

interface TeamAchievementNotification {
  id: string;
  team_id: string;
  user_id: string;
  achievement_id: string;
  is_read: boolean;
  created_at: string;
  team_achievements: TeamAchievement;
}

interface Props {
  userId: string;
}

export function TeamAchievementNotification({ userId }: Props) {
  const [notifications, setNotifications] = useState<TeamAchievementNotification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] =
    useState<TeamAchievementNotification | null>(null);

  // 💡 二重 subscribe を防ぐフラグ
  const channelRef = useRef<any>(null);

  // ------- 初期読み込み -------
  useEffect(() => {
    if (!userId) return;

    loadUnreadNotifications();
    //setupSubscription();

    return () => {
      // 🔥 クリーンアップで必ず unsubscribe
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // ------- 新しい通知があれば表示 -------
  useEffect(() => {
    if (notifications.length > 0 && !showNotification) {
      showNextNotification();
    }
  }, [notifications]);

  // ========================
  // 🔥 未読通知の読み込み
  // ========================
  const loadUnreadNotifications = async () => {
    const { data, error } = await supabase
      .from("team_achievement_notifications")
      .select(`*, team_achievements:achievement_id (*)`)
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: true });

    if (!error && data) setNotifications(data as any[]);
  };

  // ========================
  // 🔥 Realtime サブスク（安全版）
  // ========================
  const setupSubscription = () => {
    // 🔒 既にあれば必ず破棄（topic判定しない）
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  
    const channel = supabase
      .channel(`team-achievements:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_achievement_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadUnreadNotifications();
        }
      );
  
    // ✅ subscribe は1回だけ
    channel.subscribe((status) => {
      console.log("🔔 TeamAchievement channel:", status);
    });
  
    channelRef.current = channel;
  };

  // ========================
  // 🔥 次の通知をポップアップ表示
  // ========================
  const showNextNotification = () => {
    if (notifications.length > 0 && !showNotification) {
      setCurrentNotification(notifications[0]);
      setShowNotification(true);
      triggerConfetti();
    }
  };

  // ========================
  // 🎉 Confetti 演出
  // ========================
  const triggerConfetti = () => {
    const duration = 2500;
    const end = Date.now() + duration;

    const defaults = {
      startVelocity: 25,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
    };

    const interval: any = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 50 * (timeLeft / duration);

      confetti({ ...defaults, particleCount, origin: { x: 0.2, y: 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.8, y: 0.2 } });
    }, 200);
  };

  // ========================
  // ❌ 通知閉じる
  // ========================
  const handleClose = async () => {
    if (!currentNotification) return;

    await supabase.rpc("mark_team_notification_read", {
      p_notification_id: currentNotification.id,
    });

    setShowNotification(false);

    setNotifications((prev) =>
      prev.filter((n) => n.id !== currentNotification.id)
    );

    setCurrentNotification(null);

    setTimeout(showNextNotification, 500);
  };

  // ========================
  // アイコン選択
  // ========================
  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "team_streak":
        return Users;
      case "team_personal_best":
        return Award;
      case "team_acwr_safe":
        return TrendingUp;
      case "team_goals_complete":
        return Trophy;
      default:
        return Trophy;
    }
  };

  if (!showNotification || !currentNotification) return null;

  const achievement = currentNotification.team_achievements;
  const Icon = getAchievementIcon(achievement.achievement_type);

  // ========================
  // 🎨 UI
  // ========================
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

          <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            チーム達成！
          </h2>

          <div className="mb-4">
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
              {achievement.title}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {achievement.description}
            </p>
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