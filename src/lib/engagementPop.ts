// src/lib/engagementPop.ts
export type PopType = "welcome_back" | "daily_one_word" | "none";

type DecidePopArgs = {
  todayISO: string; // "YYYY-MM-DD"
  nowMs?: number;
  /** 何日空いたら「おかえり」扱いにするか */
  welcomeBackAfterDays?: number;
};

const KEY_LAST_SEEN_MS = "bekuta:last_seen_ms";
const KEY_LAST_DAILY_DATE = "bekuta:last_daily_one_word_date";
const KEY_LAST_WELCOME_DATE = "bekuta:last_welcome_back_date";

export function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

export function writeString(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function msToDays(diffMs: number): number {
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * 次に出すPOPを決める
 * 優先順位：
 * 1) welcome_back（久々） 2) daily_one_word（当日初回） 3) none
 */
export function decidePopType(args: DecidePopArgs): PopType {
  const nowMs = args.nowMs ?? Date.now();
  const welcomeAfter = args.welcomeBackAfterDays ?? 3;

  const lastSeenMs = readNumber(KEY_LAST_SEEN_MS);
  const lastDailyDate = readString(KEY_LAST_DAILY_DATE);
  const lastWelcomeDate = readString(KEY_LAST_WELCOME_DATE);

  const isFirstOpenTodayForDaily = lastDailyDate !== args.todayISO;

  // 久々判定（lastSeenがある場合のみ）
  const daysAway =
    lastSeenMs != null ? msToDays(Math.max(0, nowMs - lastSeenMs)) : 0;

  const isWelcomeBack = lastSeenMs != null && daysAway >= welcomeAfter;

  // 同日にwelcomeを出したなら、重複して出さない
  const welcomeAlreadyShownToday = lastWelcomeDate === args.todayISO;

  if (isWelcomeBack && !welcomeAlreadyShownToday) return "welcome_back";
  if (isFirstOpenTodayForDaily) return "daily_one_word";
  return "none";
}

/**
 * POPを閉じたときに「今日出した」扱いにする
 */
export function markPopShown(popType: PopType, todayISO: string) {
  const nowMs = Date.now();
  writeNumber(KEY_LAST_SEEN_MS, nowMs);

  if (popType === "daily_one_word") {
    writeString(KEY_LAST_DAILY_DATE, todayISO);
  }
  if (popType === "welcome_back") {
    writeString(KEY_LAST_WELCOME_DATE, todayISO);
  }
}

/**
 * 画面表示時（App起動/トップ表示時）に lastSeen を更新
 * ※POPの表示有無に関係なく更新する派はこっち
 */
export function touchLastSeen() {
  writeNumber(KEY_LAST_SEEN_MS, Date.now());
}

/**
 * デバッグ用に状態を見る（任意）
 */
export function getEngagementState() {
  return {
    lastSeenMs: readNumber(KEY_LAST_SEEN_MS),
    lastDailyDate: readString(KEY_LAST_DAILY_DATE),
    lastWelcomeDate: readString(KEY_LAST_WELCOME_DATE),
  };
}