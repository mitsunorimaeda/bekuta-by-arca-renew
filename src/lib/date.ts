// 日本時間の今日 YYYY-MM-DD を返す
export function getTodayJSTString() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split('T')[0];
  }
  
  // Date オブジェクトで今日(JST)が欲しいとき
  export function getTodayJST() {
    const now = new Date();
    return new Date(now.getTime() + 9 * 60 * 60 * 1000);
  }