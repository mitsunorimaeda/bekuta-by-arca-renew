// lib/date.ts

// JST（UTC+9）のオフセット
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 任意の Date を「JST 相当の時刻」にずらした Date に変換
 * （内部的には UTC に 9時間足した値を持つ Date）
 */
export function toJST(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

/**
 * 任意の Date を「JST の YYYY-MM-DD」文字列に変換（メインフォーマッタ）
 */
export function formatDateToJST(date: Date): string {
  const jst = toJST(date);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 今日（JST）の Date を返す
 */
export function getTodayJST(): Date {
  return toJST(new Date());
}

/**
 * 今日（JST）の YYYY-MM-DD を返す
 */
export function getTodayJSTString(): string {
  return formatDateToJST(new Date());
}

/**
 * JST 基準で「今日から N 日前」の YYYY-MM-DD を返す
 */
export function getJSTDateMinusDays(days: number): string {
  const base = getTodayJST();
  base.setUTCDate(base.getUTCDate() - days);
  return formatDateToJST(base);
}

/**
 * 任意の日付から daysDiff 日ずらした JST の YYYY-MM-DD を返す
 * 例: getJSTDateFrom(date, -27) → その日から27日前
 */
export function getJSTDateFrom(date: Date, daysDiff: number): string {
  const base = toJST(date);
  base.setUTCDate(base.getUTCDate() + daysDiff);
  return formatDateToJST(base);
}

/**
 * 何年前の「今日」（JST）の YYYY-MM-DD を返す
 */
export function getYearsAgoJST(years: number): string {
  const base = getTodayJST();
  base.setUTCFullYear(base.getUTCFullYear() - years);
  return formatDateToJST(base);
}

/**
 * 旧関数との互換用：何年前の「今日」
 * 中身は getYearsAgoJST と同じ
 */
export function getYearsAgoString(years: number): string {
  return getYearsAgoJST(years);
}

/**
 * ローカルタイムゾーン基準の YYYY-MM-DD
 * ※UIの表示用など、「その端末のタイムゾーンで見た日付」が欲しいとき用
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 旧: getDaysAgoJSTString
 * JST基準で「今日から N 日前」の YYYY-MM-DD
 */
export function getDaysAgoJSTString(days: number): string {
  return getJSTDateMinusDays(days);
}

/**
 * 旧: getJSTDAYSAGOString
 * JST のまま N 日前の YYYY-MM-DD
 */
export function getJSTDAYSAGOString(days: number): string {
  return getJSTDateMinusDays(days);
}

/**
 * 任意の日付から n 日前の Date（ローカル）
 * 日付ループなどで「Date 型のまま」扱いたいとき用
 */
export function getDateNDaysAgo(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * 旧: toJSTDateString
 * 任意の Date を JST の YYYY-MM-DD に変換
 */
export function toJSTDateString(date: Date): string {
  return formatDateToJST(date);
}

/**
 * 旧: formatDateJST とほぼ同等
 * → そのまま formatDateToJST を使えばよいので alias 化
 */
export function formatDateJST(date: Date): string {
  return formatDateToJST(date);
}

export function getNowJSTISOString(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().replace('Z', '+09:00'); 
}