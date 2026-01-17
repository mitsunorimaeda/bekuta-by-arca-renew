// src/lib/perfInsight.ts
export type PerfDirection = "higher" | "lower";

export type PerfInsightInput = {
  // 表示用
  athleteName?: string;
  testDisplayName: string;

  // 値
  latestValue: number | null;
  bestValue?: number | null;

  // 単位
  unitLabel?: string; // "kg", "秒", "cm", "×BW" など

  // 方向性（速いほど良い種目は lower）
  direction: PerfDirection;

  // 比較（任意）
  teamAvg?: number | null;
  p10?: number | null;
  p90?: number | null;

  // ランキング（任意）
  teamRank?: number | null; // 1 がトップ
  teamN?: number | null;
  topPercent?: number | null; // 0〜100

  // 変化（任意）
  prevValue?: number | null; // 直前（あるなら）
};

export type PerfInsight = {
  title: string;
  bullets: string[];
  nextActions: string[];
  note?: string;
};

// -------------------------
// helpers
// -------------------------
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export const roundTo = (n: number, digits: number) => {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
};

export const formatVal = (v: number, digits: number, unit?: string) => {
  const s = v.toFixed(digits);
  return unit ? `${s} ${unit}` : s;
};

export const digitsForTest = (testDisplayName?: string) => {
  // RSI/RSI-mod 系は小数2、その他は基本2で統一したいなら 2 に。
  // いま「基本小数点第2位まで」と言ってたので既定2にする。
  if (!testDisplayName) return 2;
  const n = testDisplayName.toLowerCase();
  if (n.includes("rsi")) return 2;
  return 2;
};

export const inferDirection = (testDisplayName: string): PerfDirection => {
  const n = testDisplayName.toLowerCase();

  // 低いほど良い：タイム系っぽいもの
  if (n.includes("10m") || n.includes("20m") || n.includes("30m")) return "lower";
  if (n.includes("sprint") || n.includes("dash")) return "lower";
  if (n.includes("time") || n.includes("秒") || n.includes("sec")) return "lower";

  // それ以外は高いほど良い（ジャンプ、筋力、回数、距離 etc）
  return "higher";
};

const betterThan = (a: number, b: number, dir: PerfDirection) => {
  return dir === "higher" ? a > b : a < b;
};

const diff = (a: number, b: number, dir: PerfDirection) => {
  // 「良くなった」は dir によって符号が逆
  const d = a - b;
  return dir === "higher" ? d : -d;
};

const gradeVsTeam = (latest: number, teamAvg: number, dir: PerfDirection) => {
  const d = diff(latest, teamAvg, dir);
  // 0.0 付近の誤差を吸う
  const eps = Math.max(Math.abs(teamAvg) * 0.002, 0.0001);

  if (d > eps) return "above"; // 平均より良い
  if (d < -eps) return "below"; // 平均より悪い
  return "equal";
};

// -------------------------
// main
// -------------------------
export const buildPerfInsight = (input: PerfInsightInput): PerfInsight | null => {
  const {
    athleteName,
    testDisplayName,
    latestValue,
    bestValue,
    unitLabel,
    direction,
    teamAvg,
    p10,
    p90,
    teamRank,
    teamN,
    topPercent,
    prevValue,
  } = input;

  if (latestValue == null || !Number.isFinite(latestValue)) return null;

  const digits = digitsForTest(testDisplayName);

  const title = `${athleteName ? athleteName + "：" : ""}${testDisplayName}の要点`;

  const bullets: string[] = [];
  const nextActions: string[] = [];

  bullets.push(`最新：${formatVal(latestValue, digits, unitLabel)}`);

  if (bestValue != null && Number.isFinite(bestValue)) {
    // best が良い方向かを考慮（方向性があるので best の意味は既にbestとして保存されている想定）
    bullets.push(`ベスト：${formatVal(bestValue, digits, unitLabel)}`);
  }

  // 直前との差
  if (prevValue != null && Number.isFinite(prevValue)) {
    const d = diff(latestValue, prevValue, direction);
    const sign = d >= 0 ? "+" : "";
    bullets.push(`前回比：${sign}${roundTo(d, digits).toFixed(digits)}（良化方向 기준）`);
    if (Math.abs(d) < Math.max(Math.abs(latestValue) * 0.003, 0.0001)) {
      nextActions.push("変化が小さいので、まずはフォーム/条件（シューズ・路面・ウォームアップ）を固定して再測定");
    }
  }

  // チーム平均との差（あれば）
  if (teamAvg != null && Number.isFinite(teamAvg)) {
    const g = gradeVsTeam(latestValue, teamAvg, direction);
    const d = diff(latestValue, teamAvg, direction);
    const sign = d >= 0 ? "+" : "";
    bullets.push(`チーム平均：${formatVal(teamAvg, digits, unitLabel)}（平均との差：${sign}${roundTo(d, digits).toFixed(digits)} 良化方向 기준）`);

    if (g === "above") {
      bullets.push("評価：平均以上（強み候補）");
      nextActions.push("強みを維持：週1回は同条件で再現性チェック（同じアップ→同じ測定）");
    } else if (g === "below") {
      bullets.push("評価：平均未満（課題候補）");
      // 種目ざっくり分岐
      const n = testDisplayName.toLowerCase();
      if (direction === "lower") {
        nextActions.push("課題仮説：加速局面の出力/接地のロス。動画で“接地位置と上体角”を確認");
        nextActions.push("ドリル：10mなら『2歩加速→10m』を週2（短時間）で反復");
      } else {
        nextActions.push("課題仮説：出力 or 反発の不足。可動域と力発揮の両面でチェック");
        nextActions.push("ドリル：ジャンプ系なら『低強度ポゴ→中強度』の漸進で反発を作る");
      }
    } else {
      bullets.push("評価：平均同等");
      nextActions.push("次の伸び代：まず“ベストが出る条件”を再現（測定前ルーティンの固定）");
    }
  }

  // 分布（p10/p90）あれば位置づけ
  if (p10 != null && p90 != null && Number.isFinite(p10) && Number.isFinite(p90)) {
    // lower のときは p10 が“速い側”なので扱い注意：ここでは単に帯域として表示
    bullets.push(`目安レンジ：P10 ${formatVal(p10, digits, unitLabel)} / P90 ${formatVal(p90, digits, unitLabel)}`);
    const inBand =
      direction === "higher"
        ? latestValue >= Math.min(p10, p90) && latestValue <= Math.max(p10, p90)
        : latestValue <= Math.max(p10, p90) && latestValue >= Math.min(p10, p90); // lowerでも同じ帯域判定
    if (!inBand) nextActions.push("レンジ外：測定条件の違い（機器/フォーム/ウォームアップ）を疑って再測定");
  }

  // ランキング（任意）
  if (teamRank != null && teamN != null && teamN > 0) {
    bullets.push(`順位：${teamRank}/${teamN}${topPercent != null ? `（上位${roundTo(topPercent, 1)}%）` : ""}`);
    if (teamRank <= Math.max(3, Math.floor(teamN * 0.1))) {
      nextActions.push("上位帯：伸びた要因（睡眠/栄養/練習内容）をメモして再現性を高める");
    }
  }

  const note =
    "※このコメントは内部ルールで生成しています（原因の断定はせず、次の確認・行動に繋げる設計）。";

  return {
    title,
    bullets: bullets.filter(Boolean),
    nextActions: Array.from(new Set(nextActions)).slice(0, 4),
    note,
  };
};