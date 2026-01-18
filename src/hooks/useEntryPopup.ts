import { useEffect, useMemo, useState } from "react";

type Mode = "none" | "welcome_back" | "daily_tip";

type State = {
  open: boolean;
  mode: Mode;
  daysAway: number;
};

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function toYMD(d: Date) {
  // 端末ローカル日付でOK（JST運用なら端末もほぼJSTの想定）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 「久々」&「今日の一言」POPを一つに統合して制御するHook
 * 優先順位：
 *  1) おかえり（thresholdDays以上空いた）
 *  2) 今日の一言（当日初回オープンのみ）
 */
export function useEntryPopup(opts: {
  userId: string;
  keyPrefix?: string;          // 画面ごとに分けたい場合（athlete/staff等）
  thresholdDays?: number;      // 何日空いたら「おかえり」
  enableDailyTip?: boolean;    // 今日の一言POPを使うか
}) {
  const {
    userId,
    keyPrefix = "athlete",
    thresholdDays = 3,
    enableDailyTip = true,
  } = opts;

  const keys = useMemo(() => {
    return {
      lastOpenAt: `bekuta:${keyPrefix}:last_open_at:${userId}`,
      lastDailyShown: `bekuta:${keyPrefix}:last_daily_tip_shown:${userId}`,
      dismissedToday: `bekuta:${keyPrefix}:dismissed_today:${userId}`,
    };
  }, [keyPrefix, userId]);

  const [state, setState] = useState<State>({
    open: false,
    mode: "none",
    daysAway: 0,
  });

  useEffect(() => {
    const now = new Date();
    const todayYMD = toYMD(now);

    // 当日すでに閉じられてたら出さない（“パン”だけ運用）
    const dismissed = safeGet(keys.dismissedToday);
    if (dismissed === todayYMD) {
      // last_open_atだけは更新しておく（久々判定の精度維持）
      safeSet(keys.lastOpenAt, now.toISOString());
      return;
    }

    const prevOpen = safeGet(keys.lastOpenAt);
    const prevDaily = safeGet(keys.lastDailyShown);

    let mode: Mode = "none";
    let daysAway = 0;

    // ① おかえり判定（優先）
    if (prevOpen) {
      const prevDt = new Date(prevOpen);
      daysAway = daysBetween(prevDt, now);
      if (Number.isFinite(daysAway) && daysAway >= thresholdDays) {
        mode = "welcome_back";
      }
    }

    // ② 今日の一言（当日初回のみ）
    if (mode === "none" && enableDailyTip) {
      if (prevDaily !== todayYMD) {
        mode = "daily_tip";
      }
    }

    if (mode !== "none") {
      setState({ open: true, mode, daysAway });
      // 今日の一言を表示扱いにするのは “表示が決まった時点” でOK
      if (mode === "daily_tip") {
        safeSet(keys.lastDailyShown, todayYMD);
      }
    }

    // 最終オープン時刻は常に更新
    safeSet(keys.lastOpenAt, now.toISOString());
  }, [keys, thresholdDays, enableDailyTip]);

  const dismiss = () => {
    const todayYMD = toYMD(new Date());
    safeSet(keys.dismissedToday, todayYMD);
    setState((s) => ({ ...s, open: false, mode: "none" }));
  };

  return { ...state, dismiss };
}