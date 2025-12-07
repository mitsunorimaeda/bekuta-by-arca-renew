// YYYY-MM-DD（日本時間ローカル）の今日を返す
export function getTodayJSTString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Dateオブジェクトで今日(JST)が欲しいとき
// ※実際は new Date() がそのまま JST の現在日時になるのでこれでOK
export function getTodayJST(): Date {
  return new Date();
}