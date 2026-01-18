// src/hooks/useEntryPopup.ts
import { useEffect, useMemo, useState, useCallback } from "react";

export type Mode = "none" | "welcome_back" | "daily_one_word";
export type Action = "ok" | "close";

type State = {
  open: boolean;
  mode: Mode;
  daysAway: number;
  todayYMD: string;
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
  } catch {}
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 「久々」&「今日の一言」POPを統合して制御するHook
 * 優先順位：
 *  1) welcome_back（thresholdDays以上空いた）
 *  2) daily_one_word（当日初回のみ）
 *
 * 重要：表示済み扱いは「閉じた瞬間（ok/close）」に書く
 */
export function useEntryPopup(opts: {
  userId: string;
  keyPrefix?: string;
  thresholdDays?: number;
  enableDailyOneWord?: boolean; // ✅ 名前を合わせる（旧 enableDailyTip でも呼べるように下で吸収）
  enableDailyTip?: boolean;     // ✅ 互換用（AthleteView側がまだこれを渡していても動く）
}) {
  const {
    userId,
    keyPrefix = "athlete",
    thresholdDays = 3,
    enableDailyOneWord,
    enableDailyTip,
  } = opts;

  // ✅ 互換：どちらか true なら daily_one_word を有効
  const enableDaily = (enableDailyOneWord ?? enableDailyTip ?? true);

  const keys = useMemo(() => {
    return {
      lastOpenAt: `bekuta:${keyPrefix}:last_open_at:${userId}`,
      lastDailyShown: `bekuta:${keyPrefix}:last_daily_one_word_shown:${userId}`,
      lastWelcomeShown: `bekuta:${keyPrefix}:last_welcome_shown:${userId}`,
      dismissedToday: `bekuta:${keyPrefix}:dismissed_today:${userId}`,
    };
  }, [keyPrefix, userId]);

  const [state, setState] = useState<State>({
    open: false,
    mode: "none",
    daysAway: 0,
    todayYMD: toYMD(new Date()),
  });

  useEffect(() => {
    const now = new Date();
    const todayYMD = toYMD(now);

    // 当日すでに閉じられてたら出さない（“1日1回”運用）
    const dismissed = safeGet(keys.dismissedToday);
    if (dismissed === todayYMD) {
      // last_open_atだけは更新（久々判定の精度維持）
      safeSet(keys.lastOpenAt, now.toISOString());
      setState((s) => ({ ...s, open: false, mode: "none", todayYMD }));
      return;
    }

    const prevOpen = safeGet(keys.lastOpenAt);
    const prevDaily = safeGet(keys.lastDailyShown);
    const prevWelcome = safeGet(keys.lastWelcomeShown);

    let mode: Mode = "none";
    let daysAway = 0;

    // ① おかえり（優先）
    if (prevOpen) {
      const prevDt = new Date(prevOpen);
      daysAway = daysBetween(prevDt, now);
      const welcomeAlreadyShownToday = prevWelcome === todayYMD;

      if (
        Number.isFinite(daysAway) &&
        daysAway >= thresholdDays &&
        !welcomeAlreadyShownToday
      ) {
        mode = "welcome_back";
      }
    }

    // ② 今日の一言（当日初回のみ）
    if (mode === "none" && enableDaily) {
      if (prevDaily !== todayYMD) {
        mode = "daily_one_word";
      }
    }

    if (mode !== "none") {
      setState({ open: true, mode, daysAway, todayYMD });
    } else {
      setState((s) => ({ ...s, open: false, mode: "none", daysAway, todayYMD }));
    }

    // 最終オープン時刻は常に更新
    safeSet(keys.lastOpenAt, now.toISOString());
  }, [keys, thresholdDays, enableDaily]);

  // ok/close どちらで閉じたかを渡せる（引数なしでもOK）
  const dismiss = useCallback(
    (action: Action = "close") => {
      const now = new Date();
      const todayYMD = toYMD(now);

      // 当日もう出さない
      safeSet(keys.dismissedToday, todayYMD);

      // 表示済みマーク（閉じた瞬間）
      if (state.mode === "daily_one_word") {
        safeSet(keys.lastDailyShown, todayYMD);
      }
      if (state.mode === "welcome_back") {
        safeSet(keys.lastWelcomeShown, todayYMD);
      }

      // lastOpenAtも更新
      safeSet(keys.lastOpenAt, now.toISOString());

      setState((s) => ({ ...s, open: false, mode: "none" }));
      return action;
    },
    [keys, state.mode]
  );

  return { ...state, dismiss };
}