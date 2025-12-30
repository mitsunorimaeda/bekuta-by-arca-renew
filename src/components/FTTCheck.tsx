import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Screen = "standby" | "measure" | "result";

type ConditionResult = "good" | "fatigue" | "danger" | "stop" | "calibrating";

const DURATION_MS = 10_000;

function mean(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function stddev(nums: number[]) {
  if (nums.length <= 1) return 0;
  const m = mean(nums);
  const v = nums.reduce((a, b) => a + (b - m) * (b - m), 0) / nums.length; // population SD
  return Math.sqrt(v);
}

// JSTの YYYY-MM-DD
function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function FTTCheck() {
  const [screen, setScreen] = useState<Screen>("standby");
  const [isActive, setIsActive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [tapCount, setTapCount] = useState(0);

  const [resultCount, setResultCount] = useState(0);
  const [resultSD, setResultSD] = useState(0);
  const [resultIntervals, setResultIntervals] = useState<number[]>([]);
  const [condition, setCondition] = useState<ConditionResult>("calibrating");
  const [message, setMessage] = useState("");

  const startTimeRef = useRef<number>(0);
  const tapsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  // UI ripple（簡易）
  const tapAreaRef = useRef<HTMLDivElement | null>(null);

  // CSSはこのコンポーネント内で最低限（既存デザインに合わせて調整してOK）
  const styles = useMemo(
    () => ({
      container: {
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: `'Courier New', Courier, monospace`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        userSelect: "none" as const,
        WebkitUserSelect: "none" as const,
      },
      panel: { width: "100%", maxWidth: 420 },
      title: {
        fontSize: 22,
        letterSpacing: 2,
        borderBottom: "1px solid #8b949e",
        paddingBottom: 10,
        display: "inline-block",
        marginBottom: 14,
      },
      instruction: { color: "#8b949e", fontSize: 14, lineHeight: 1.7, textAlign: "left" as const },
      btn: {
        width: "100%",
        marginTop: 18,
        padding: "14px 18px",
        border: "1px solid #238636",
        background: "transparent",
        color: "#238636",
        fontSize: 16,
        letterSpacing: 2,
      },
      timer: { fontSize: 48, fontWeight: 800, textAlign: "center" as const, marginBottom: 12 },
      tapArea: {
        height: 320,
        background: "#161b22",
        border: "1px solid #8b949e",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative" as const,
        touchAction: "manipulation" as const,
        userSelect: "none" as const,
        WebkitUserSelect: "none" as const,
        WebkitTouchCallout: "none" as const,
      },
      counter: { color: "#8b949e", marginTop: 10, textAlign: "center" as const },
      resultBox: { background: "#161b22", border: "1px solid #8b949e", padding: 16 },
      row: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px dashed #333" },
      badge: (c: ConditionResult) => {
        const base = {
          marginTop: 12,
          padding: "8px 10px",
          borderRadius: 2,
          textAlign: "center" as const,
          fontWeight: 800,
          letterSpacing: 1,
        };
        if (c === "good") return { ...base, background: "rgba(35,134,54,.2)", border: "1px solid #3fb950", color: "#3fb950" };
        if (c === "fatigue") return { ...base, background: "rgba(210,153,34,.2)", border: "1px solid #d29922", color: "#d29922" };
        if (c === "danger") return { ...base, background: "rgba(248,81,73,.2)", border: "1px solid #f85149", color: "#f85149" };
        if (c === "stop") return { ...base, background: "rgba(248,81,73,.2)", border: "1px solid #f85149", color: "#f85149" };
        return { ...base, background: "rgba(139,148,158,.15)", border: "1px solid #8b949e", color: "#8b949e" };
      },
    }),
    []
  );

  function reset() {
    setIsActive(false);
    setRemainingMs(DURATION_MS);
    setTapCount(0);
    tapsRef.current = [];
    startTimeRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function start() {
    reset();
    setScreen("measure");
    setIsActive(true);
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    if (!isActive) return;
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const remaining = Math.max(0, DURATION_MS - elapsed);
    setRemainingMs(remaining);

    if (remaining <= 0) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleTap(e: React.PointerEvent<HTMLDivElement>) {
    if (!isActive) return;

    // iOSの誤動作防止（ズーム等）
    if ((e as any).cancelable) e.preventDefault();

    const now = performance.now();
    if (tapsRef.current.length === 0 || now - startTimeRef.current <= DURATION_MS) {
      tapsRef.current.push(now);
      setTapCount(tapsRef.current.length);
      ripple(e);
    }
  }

  function ripple(e: React.PointerEvent<HTMLDivElement>) {
    const el = tapAreaRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const circle = document.createElement("div");
    circle.style.position = "absolute";
    circle.style.borderRadius = "999px";
    circle.style.pointerEvents = "none";
    circle.style.width = "52px";
    circle.style.height = "52px";
    circle.style.left = `${e.clientX - rect.left - 26}px`;
    circle.style.top = `${e.clientY - rect.top - 26}px`;
    circle.style.background = "rgba(255,255,255,.35)";
    circle.style.transform = "scale(0)";
    circle.style.transition = "transform 380ms linear, opacity 380ms linear";
    el.appendChild(circle);
    requestAnimationFrame(() => {
      circle.style.transform = "scale(4)";
      circle.style.opacity = "0";
    });
    setTimeout(() => circle.remove(), 400);
  }

  async function finish() {
    setIsActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const taps = tapsRef.current;
    const count = taps.length;

    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);

    const sd = stddev(intervals);

    setResultCount(count);
    setResultSD(sd);
    setResultIntervals(intervals);

    // 判定（DBベースライン使用）
    const evaluated = await evaluateWithBaseline(count, sd);

    setCondition(evaluated.condition);
    setMessage(evaluated.message);

    // 保存
    const { error } = await supabase.from("ftt_records").insert({
        user_id: user.id,
        date,
        duration_sec: payload.duration_sec,
        total_count: payload.total_count,
        interval_sd_ms: payload.interval_sd_ms,
        raw_intervals_ms: payload.raw_intervals_ms,
        condition_result: payload.condition_result,
        meta: {
          ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      
      if (error) {
        console.error("[FTT save error]", error);
        alert(error.message); // ← 一時的にこれでOK
      }

    setScreen("result");
  }

  async function evaluateWithBaseline(todayCount: number, todaySD: number): Promise<{ condition: ConditionResult; message: string }> {
    const minSamples = 5;        // 3〜5の上側に寄せる（安定）
    const windowDays = 30;
    const speedDropRatio = 0.9;  // -10%
    const sdWorseRatio = 0.25;   // +25%悪化で「乱れ」

    // 直近30日（最大60件くらい取れればOK）
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return { condition: "calibrating", message: "ログイン情報が取得できませんでした。" };
    }
    const userId = userRes.user.id;

    // measured_at desc で直近を取得 → 30日分フィルタは date でやってもOK
    const { data, error } = await supabase
      .from("ftt_records")
      .select("date,total_count,interval_sd_ms,measured_at")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(120);

    if (error) {
      // DBが未準備でも測定は成立させる
      return { condition: "calibrating", message: "ベースライン取得に失敗しました（初回は判定しません）。" };
    }

    // 30日分に絞る
    const today = new Date();
    const start = new Date(today.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const recent = (data ?? []).filter((r: any) => {
      const d = new Date(String(r.date) + "T00:00:00");
      return d >= start;
    });

    if (recent.length < minSamples) {
      return { condition: "calibrating", message: "キャリブレーション中（あと数回で判定が出ます）。" };
    }

    const baselineSpeed = mean(recent.map((r: any) => Number(r.total_count)));
    const baselineSD = mean(recent.map((r: any) => Number(r.interval_sd_ms)));

    const isSlow = todayCount < baselineSpeed * speedDropRatio;
    const isUnstable = todaySD > baselineSD * (1 + sdWorseRatio);

    if (isSlow && isUnstable) {
      return { condition: "stop", message: "心身ともに限界です。勇気を持って休息をとってください。" };
    }
    if (isUnstable) {
      return { condition: "danger", message: "体は動きますが制御が効いていません。怪我リスクが高い状態です。アップを念入りに。" };
    }
    if (isSlow) {
      return { condition: "fatigue", message: "脳が少しお疲れモード。今日は質の高い睡眠を優先しましょう。" };
    }
    return { condition: "good", message: "コンディション良好。高いパフォーマンスが期待できます。" };
  }

  async function saveRecord(payload: {
    duration_sec: number;
    total_count: number;
    interval_sd_ms: number;
    raw_intervals_ms: number[];
    condition_result: ConditionResult;
  }) {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    const date = getTodayJST();

    await supabase.from("ftt_records").insert({
      user_id: user.id,
      date,
      duration_sec: payload.duration_sec,
      total_count: payload.total_count,
      interval_sd_ms: payload.interval_sd_ms,
      raw_intervals_ms: payload.raw_intervals_ms,
      condition_result: payload.condition_result,
      meta: {
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  }

  // unmount cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        {screen === "standby" && (
          <>
            <div style={styles.title}>FTT CHECK</div>
            <div style={styles.instruction}>
              <ul>
                <li>スマホを机に置いて固定</li>
                <li>利き手の人差し指 1本で</li>
                <li>10秒間、速く・一定のリズムでタップ</li>
              </ul>
            </div>
            <button style={styles.btn} onClick={start}>
              START
            </button>
          </>
        )}

        {screen === "measure" && (
          <>
            <div style={styles.timer}>{(remainingMs / 1000).toFixed(2)}</div>
            <div
              ref={tapAreaRef}
              style={styles.tapArea}
              onPointerDown={handleTap}
            >
              <div style={{ color: "#8b949e", fontSize: 12, letterSpacing: 2 }}>TAP HERE</div>
            </div>
            <div style={styles.counter}>TAPS: {tapCount}</div>
          </>
        )}

        {screen === "result" && (
          <>
            <div style={styles.title}>RESULT</div>
            <div style={styles.resultBox}>
              <div style={styles.row}>
                <span style={{ color: "#8b949e" }}>SPEED (Total)</span>
                <span style={{ fontWeight: 800, fontSize: 20 }}>{resultCount}</span>
              </div>
              <div style={styles.row}>
                <span style={{ color: "#8b949e" }}>STABILITY (SD)</span>
                <span style={{ fontWeight: 800, fontSize: 20 }}>{resultSD.toFixed(2)} ms</span>
              </div>

              <div style={styles.badge(condition)}>
                {condition === "calibrating" ? "CALIBRATING" : condition.toUpperCase()}
              </div>
              <div style={{ marginTop: 10, color: "#e6edf3", fontSize: 13, lineHeight: 1.6 }}>{message}</div>

              {/* 生データ可視化は後で拡張できる（ftt.htmlの waveform をここに移植可） */}
              <div style={{ marginTop: 10, color: "#8b949e", fontSize: 11 }}>
                intervals: {resultIntervals.length}
              </div>
            </div>

            <button
              style={{ ...styles.btn, borderColor: "#8b949e", color: "#8b949e" }}
              onClick={() => {
                reset();
                setScreen("standby");
              }}
            >
              RETRY
            </button>
          </>
        )}
      </div>
    </div>
  );
}