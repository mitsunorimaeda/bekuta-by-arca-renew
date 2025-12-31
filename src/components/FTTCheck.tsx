// src/components/FTTCheck.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Timer, Hand, Save, RotateCcw, ShieldAlert, Sparkles, ArrowLeft } from "lucide-react";

type Screen = "standby" | "measure" | "result";
type ConditionResult = "good" | "fatigue" | "danger" | "stop" | "calibrating";

type Props = {
  userId: string;
  onBackHome?: () => void;
};

const DURATION_MS = 10_000;

// ===== utils =====
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function conditionLabel(c: ConditionResult) {
  switch (c) {
    case "good":
      return { title: "GOOD", sub: "コンディション良好", icon: Sparkles };
    case "fatigue":
      return { title: "FATIGUE", sub: "少しお疲れモード", icon: Timer };
    case "danger":
      return { title: "DANGER", sub: "制御が効きにくい状態", icon: ShieldAlert };
    case "stop":
      return { title: "STOP", sub: "休息が必要", icon: ShieldAlert };
    default:
      return { title: "CALIBRATING", sub: "判定準備中", icon: Timer };
  }
}

function conditionBadgeClass(c: ConditionResult) {
  switch (c) {
    case "good":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "fatigue":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "danger":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "stop":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
  }
}

export function FTTCheck({ userId, onBackHome }: Props) {
  const [screen, setScreen] = useState<Screen>("standby");

  const isActiveRef = useRef(false);
  const [isActive, setIsActive] = useState(false);

  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [tapCount, setTapCount] = useState(0);

  const [resultCount, setResultCount] = useState(0);
  const [resultSD, setResultSD] = useState(0);
  const [resultIntervals, setResultIntervals] = useState<number[]>([]);
  const [condition, setCondition] = useState<ConditionResult>("calibrating");
  const [message, setMessage] = useState("");

  // 保存ステータス
  const [didSave, setDidSave] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const startTimeRef = useRef<number>(0);
  const tapsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  const tapAreaRef = useRef<HTMLDivElement | null>(null);

  // ✅ その「測定1回」を識別するID（eventsに紐づける）
  const eventIdRef = useRef<string | null>(null);

  const progress = useMemo(() => {
    const p = 1 - remainingMs / DURATION_MS;
    return clamp(p, 0, 1);
  }, [remainingMs]);

  // ===== state reset =====
  function resetLocal() {
    setIsActive(false);
    isActiveRef.current = false;

    setRemainingMs(DURATION_MS);
    setTapCount(0);
    tapsRef.current = [];
    startTimeRef.current = 0;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    // ここは「今回測定の」eventIdを捨てる（過去のeventsはDBに残る）
    eventIdRef.current = null;

    setDidSave(false);
    setSaveBusy(false);
    setSaveStatus("");
  }

  function start() {
    resetLocal();
    setScreen("measure");

    setIsActive(true);
    isActiveRef.current = true;

    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick() {
    if (!isActiveRef.current) return;

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
    if (!isActiveRef.current) return;

    if ((e as any).cancelable) e.preventDefault();

    const now = performance.now();
    tapsRef.current.push(now);
    setTapCount(tapsRef.current.length);

    ripple(e);
  }

  function ripple(e: React.PointerEvent<HTMLDivElement>) {
    const el = tapAreaRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const circle = document.createElement("div");
    circle.style.position = "absolute";
    circle.style.borderRadius = "999px";
    circle.style.pointerEvents = "none";
    circle.style.width = "54px";
    circle.style.height = "54px";
    circle.style.left = `${e.clientX - rect.left - 27}px`;
    circle.style.top = `${e.clientY - rect.top - 27}px`;
    circle.style.background = "rgba(59,130,246,.20)";
    circle.style.transform = "scale(0)";
    circle.style.transition = "transform 420ms ease, opacity 420ms ease";
    el.appendChild(circle);

    requestAnimationFrame(() => {
      circle.style.transform = "scale(5)";
      circle.style.opacity = "0";
    });
    setTimeout(() => circle.remove(), 450);
  }

  /**
   * ✅ 合意仕様の核
   * 測定が終わった時点で「測定した事実」を必ず残す（未保存ログ）
   * → ftt_events.insert({ user_id, did_save:false })
   * 返ってきた id を eventIdRef に保持し、
   * SAVE 成功時にそのイベントだけ did_save=true にする
   */
  async function writeFTTEventDidNotSave() {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("ftt_events")
        .insert({
          user_id: userId,
          did_save: false,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[FTT events insert error]", error);
        return;
      }

      eventIdRef.current = data?.id ?? null;
    } catch (e) {
      console.error("[FTT events insert exception]", e);
    }
  }

  async function finish() {
    // ✅ 先に result へ
    setScreen("result");

    setIsActive(false);
    isActiveRef.current = false;

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

    const evaluated = await evaluateWithBaseline(count, sd);
    setCondition(evaluated.condition);
    setMessage(evaluated.message);

    // ✅ 軽量ログは必ず残す（未保存ログ）
    await writeFTTEventDidNotSave();
  }

  async function evaluateWithBaseline(
    todayCount: number,
    todaySD: number
  ): Promise<{ condition: ConditionResult; message: string }> {
    const minSamples = 5;
    const windowDays = 30;
    const speedDropRatio = 0.9; // -10%
    const sdWorseRatio = 0.25; // +25%

    if (!userId) {
      return { condition: "calibrating", message: "ユーザー情報が取得できませんでした。" };
    }

    const { data, error } = await supabase
      .from("ftt_records")
      .select("date,total_count,interval_sd_ms,measured_at")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(120);

    if (error) {
      return { condition: "calibrating", message: "ベースライン取得に失敗しました（初回は判定しません）。" };
    }

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

  async function handleSave() {
    if (saveBusy || didSave) return;
    if (!userId) {
      setSaveStatus("ユーザー情報が取得できませんでした。");
      return;
    }

    setSaveBusy(true);
    setSaveStatus("送信キュー待機中…（負荷分散）");

    // 軽いジッター（同時保存のスパイクを避ける）
    const jitter = Math.floor(Math.random() * 5000);
    await sleep(jitter);

    try {
      setSaveStatus("クラウドに保存中…");

      const date = getTodayJST();

      const payload = {
        duration_sec: Math.round(DURATION_MS / 1000),
        total_count: resultCount,
        interval_sd_ms: resultSD,
        raw_intervals_ms: resultIntervals,
        condition_result: condition,
      };

      // ✅ 1日1件（UNIQUE(user_id,date)）
      const { error: recErr } = await supabase
        .from("ftt_records")
        .upsert(
          {
            user_id: userId,
            date,
            duration_sec: payload.duration_sec,
            total_count: payload.total_count,
            interval_sd_ms: payload.interval_sd_ms,
            raw_intervals_ms: payload.raw_intervals_ms,
            condition_result: payload.condition_result,
            meta: {
              ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              source: "ftt_check",
            },
          },
          { onConflict: "user_id,date" }
        );

      if (recErr) {
        console.error("[FTT records upsert error]", recErr);
        setSaveStatus(`保存失敗: ${recErr.message}`);
        setSaveBusy(false);
        return;
      }

      // ✅ その測定（event）だけ did_save=true にする
      const eventId = eventIdRef.current;
      if (eventId) {
        const { error: evErr } = await supabase
          .from("ftt_events")
          .update({ did_save: true })
          .eq("id", eventId)
          .eq("user_id", userId);

        if (evErr) console.error("[FTT events update error]", evErr);
      }

      setDidSave(true);
      setSaveStatus("✅ 保存完了");
      setSaveBusy(false);
    } catch (e: any) {
      console.error("[FTT save exception]", e);
      setSaveStatus(`保存失敗: ${e?.message ?? "unknown error"}`);
      setSaveBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const headerSubtitle =
    screen === "standby"
      ? "10秒タップで、脳のキレと安定性をチェック"
      : screen === "measure"
      ? "できるだけ速く、一定のリズムで"
      : "結果を確認して、必要なら保存";

  const TimeIcon = Timer;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-md px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center">
                <TimeIcon className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">FTT Check</div>
                <div className="text-sm text-slate-500">{headerSubtitle}</div>
              </div>
            </div>

            {onBackHome && (
              <button
                onClick={onBackHome}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">戻る</span>
              </button>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          {/* Top bar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Timer className="h-4 w-4" />
              {screen === "standby" ? "Standby" : screen === "measure" ? "Measuring" : "Result"}
            </div>
            <div className="text-xs text-slate-400">Bekuta</div>
          </div>

          <div className="p-5">
            {/* Standby */}
            {screen === "standby" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 text-xs font-bold text-slate-700">
                        1
                      </span>
                      <span>スマホを机に置いて固定</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 text-xs font-bold text-slate-700">
                        2
                      </span>
                      <span>利き手の人差し指 1本でタップ</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 text-xs font-bold text-slate-700">
                        3
                      </span>
                      <span>10秒間、速く・一定のリズムで</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={start}
                  className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-extrabold tracking-wide shadow-sm hover:bg-slate-800 active:scale-[0.99] transition"
                >
                  START
                </button>

                <div className="text-xs text-slate-500 leading-relaxed">
                  ※ 基本は1日1回。ミスったらRETRYでやり直せます（測定ログは残ります）。
                </div>
              </div>
            )}

            {/* Measure */}
            {screen === "measure" && (
              <div className="space-y-4">
                {/* Timer */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Remaining</div>
                    <div className="text-4xl font-extrabold tracking-tight tabular-nums">
                      {(remainingMs / 1000).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 font-semibold flex items-center gap-2">
                    <Hand className="h-4 w-4" />
                    TAPS <span className="font-extrabold tabular-nums">{tapCount}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200">
                  <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
                </div>

                {/* Tap area */}
                <div
                  ref={tapAreaRef}
                  onPointerDown={handleTap}
                  className="relative h-72 rounded-3xl bg-gradient-to-b from-slate-50 to-white ring-1 ring-slate-200 shadow-sm overflow-hidden select-none"
                  style={{
                    touchAction: "manipulation",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-blue-100/50 blur-2xl" />
                    <div className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-emerald-100/40 blur-2xl" />
                  </div>

                  <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
                    <div className="relative h-24 w-24 flex items-center justify-center">
                      <span className="absolute h-full w-full rounded-full border border-slate-300/40 animate-ftt-ripple" />
                      <span className="absolute h-full w-full rounded-full border border-slate-300/30 animate-ftt-ripple delay-300" />
                      <span className="absolute h-full w-full rounded-full border border-slate-300/20 animate-ftt-ripple delay-600" />
                      <span className="relative z-10 h-3 w-3 rounded-full bg-slate-800 shadow-[0_0_0_6px_rgba(15,23,42,0.08)]" />
                    </div>

                    <div className="text-sm font-extrabold tracking-widest text-slate-800">TAP FAST</div>
                    <div className="text-xs text-slate-500">人差し指1本で</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    resetLocal();
                    setScreen("standby");
                  }}
                  className="w-full rounded-2xl bg-white ring-1 ring-slate-200 py-3 font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  CANCEL
                </button>
              </div>
            )}

            {/* Result */}
            {screen === "result" && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Speed (Total)</div>
                    <div className="mt-1 text-3xl font-extrabold tabular-nums">{resultCount}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Stability (SD)</div>
                    <div className="mt-1 text-3xl font-extrabold tabular-nums">
                      {resultSD.toFixed(1)}
                      <span className="text-sm font-bold text-slate-500 ml-1">ms</span>
                    </div>
                  </div>
                </div>

                {/* Condition */}
                {(() => {
                  const meta = conditionLabel(condition);
                  const Icon = meta.icon;
                  return (
                    <div className={`rounded-2xl px-4 py-3 ${conditionBadgeClass(condition)} flex items-center gap-3`}>
                      <div className="h-9 w-9 rounded-xl bg-white/70 flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-extrabold tracking-wide">{meta.title}</div>
                        <div className="text-xs opacity-80">{meta.sub}</div>
                      </div>
                      <div className="text-xs font-bold opacity-80 tabular-nums">intervals: {resultIntervals.length}</div>
                    </div>
                  );
                })()}

                <div className="text-sm text-slate-700 leading-relaxed">{message}</div>

                {/* Save button */}
                <button
                  disabled={saveBusy || didSave}
                  onClick={handleSave}
                  className={[
                    "w-full rounded-2xl py-3.5 font-extrabold tracking-wide flex items-center justify-center gap-2 transition active:scale-[0.99]",
                    didSave
                      ? "bg-emerald-600 text-white"
                      : saveBusy
                      ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500",
                  ].join(" ")}
                >
                  <Save className="h-4 w-4" />
                  {didSave ? "SAVED ✅" : saveBusy ? "SAVING..." : "SAVE DATA"}
                </button>

                {/* Save status */}
                <div
                  className={[
                    "min-h-[18px] text-xs text-center",
                    didSave ? "text-emerald-700" : saveStatus.includes("失敗") ? "text-rose-700" : "text-slate-500",
                  ].join(" ")}
                >
                  {saveStatus}
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  ※ 計測終了時点で「未保存ログ（ftt_events）」が残ります。
                  保存ボタンで「その日の正式データ（ftt_records）」として採用されます。
                </div>

                <button
                  onClick={() => {
                    resetLocal();
                    setScreen("standby");
                  }}
                  className="w-full rounded-2xl bg-white ring-1 ring-slate-200 py-3 font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  RETRY
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom hint */}
        <div className="mt-6 text-center text-xs text-slate-400">
          “fast & steady” がコツ。スピードだけでなく安定性も見ます。
        </div>
      </div>
    </div>
  );
}