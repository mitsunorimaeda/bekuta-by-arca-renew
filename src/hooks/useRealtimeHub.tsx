// src/hooks/useRealtimeHub.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";


type PollJob = {
  key: string;
  intervalMs: number;
  run: () => Promise<void> | void;

  enabled: boolean;
  requireVisible: boolean; // trueならタブ非表示で止める
  requireOnline: boolean;  // trueならofflineで止める

  // 内部状態
  nextAt: number;
  failCount: number;
};

type HubState = {
  isVisible: boolean;
  isOnline: boolean;
  canRun: boolean;        // ポーリング許可（visible & online）
  canRealtime: boolean;   // Realtime許可（visible & online）
};

type RegisterPollArgs = {
  key: string;
  intervalMs: number;
  run: () => Promise<void> | void;
  enabled?: boolean;
  requireVisible?: boolean;
  requireOnline?: boolean;
  immediate?: boolean; // trueなら登録直後に走らせたい（tick待ちしない）
};

type RealtimeHubContextValue = {
  state: HubState;
  registerPollJob: (args: RegisterPollArgs) => () => void; // unregister を返す
  unregisterJob: (key: string) => void;
};


const RealtimeHubContext = createContext<RealtimeHubContextValue | null>(null);

export function RealtimeHubProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  const jobsRef = useRef<Map<string, PollJob>>(new Map());

  // stateをrefでも持って、tick内で最新参照できるように
  const isVisibleRef = useRef(isVisible);
  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  useEffect(() => {
    const onVis = () => setIsVisible(!document.hidden);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const unregisterJob = useCallback((key: string) => {
    jobsRef.current.delete(key);
  }, []);

  const runJobOnce = useCallback(async (job: PollJob) => {
    try {
      await job.run();
      job.failCount = 0;
      job.nextAt = Date.now() + job.intervalMs;
    } catch (e) {
      job.failCount += 1;

      // 指数バックオフ（最大5分）
      const base = 2000; // 2s
      const backoff = Math.min(300000, base * Math.pow(2, Math.min(8, job.failCount)));
      job.nextAt = Date.now() + backoff;

      if (import.meta.env.DEV) {
        console.warn("[RealtimeHub] job failed:", job.key, "failCount=", job.failCount, e);
      }
    }
  }, []);

  // ✅ ハブの唯一のタイマー（ここだけが interval を持つ）
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const visible = isVisibleRef.current;
      const online = isOnlineRef.current;

      for (const job of jobsRef.current.values()) {
        if (!job.enabled) continue;
        if (job.requireVisible && !visible) continue;
        if (job.requireOnline && !online) continue;
        if (now < job.nextAt) continue;

        // fire-and-forget（次回予定の更新は runJobOnce 内で）
        void runJobOnce(job);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [runJobOnce]);

  const registerPollJob = useCallback((args: RegisterPollArgs) => {
    const {
      key,
      intervalMs,
      run,
      enabled = true,
      requireVisible = true,
      requireOnline = true,
      immediate = false,
    } = args;

    const existing = jobsRef.current.get(key);

    const job: PollJob = existing ?? {
      key,
      intervalMs,
      run,
      enabled,
      requireVisible,
      requireOnline,
      nextAt: Date.now(),
      failCount: 0,
    };

    // update
    job.intervalMs = intervalMs;
    job.run = run;
    job.enabled = enabled;
    job.requireVisible = requireVisible;
    job.requireOnline = requireOnline;

    // enabledになった瞬間は「すぐ走れる」ように
    if (enabled) {
      job.nextAt = immediate ? Date.now() : Date.now() + intervalMs;
    }

    jobsRef.current.set(key, job);

    if (immediate && enabled) {
      void runJobOnce(job);
    }

    return () => {
      jobsRef.current.delete(key);
    };
  }, [runJobOnce]);

  const state: HubState = useMemo(() => {
    const can = isVisible && isOnline;
    return {
      isVisible,
      isOnline,
      canRun: can,
      canRealtime: can,
    };
  }, [isVisible, isOnline]);

  const value: RealtimeHubContextValue = useMemo(
    () => ({ state, registerPollJob, unregisterJob }),
    [state, registerPollJob, unregisterJob]
  );

  return <RealtimeHubContext.Provider value={value}>{children}</RealtimeHubContext.Provider>;
}

export function useRealtimeHub() {
  const ctx = useContext(RealtimeHubContext);
  if (!ctx) throw new Error("useRealtimeHub must be used within RealtimeHubProvider");
  return ctx;
}