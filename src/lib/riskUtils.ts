// src/lib/riskUtils.ts

// ===============================
// 型定義
// ===============================
export type RiskLevel = 'high' | 'caution' | 'low';

export type AthleteRisk = {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  reasons: string[]; // 最大2つ
  acwr?: number | null; // ✅ 追加
};

// StaffView の weekCardMap で使ってる形に合わせる（必要最低限）
type WeekCard = {
  is_sharing_active?: boolean;
  sleep_hours_avg?: number | null;
};

type AthleteACWRInfo = {
  currentACWR: number | null;
};

type NoDataInfo = {
  daysSinceLast: number;
};

type LoadInfo = {
  load7d?: number | null;        // 直近7日合計
  load7dPrev?: number | null;    // その前7日
};

// ===============================
// 内部ユーティリティ
// ===============================
const pickTop2 = (reasons: string[]) =>
  Array.from(new Set(reasons)).slice(0, 2);

// 並び替え用の優先度
export const riskPriority: Record<RiskLevel, number> = {
  high: 3,
  caution: 2,
  low: 1,
};

// ===============================
// 🧠 リスク判定ロジック（中核）
// ===============================
export function calcRiskForAthlete(params: {
  id: string;
  name: string;
  acwrInfo?: AthleteACWRInfo | null;
  weekCard?: WeekCard | null;
  noData?: NoDataInfo | null;
}): AthleteRisk {
  const { id, name, acwrInfo, weekCard, noData } = params;

  const sharingOn = !!weekCard?.is_sharing_active;

  const acwr = acwrInfo?.currentACWR ?? null;
  const sleep = weekCard?.sleep_hours_avg ?? null;
  const daysNoInput = noData?.daysSinceLast ?? null;

  const reasons: string[] = [];

  // -------------------------------
  // 🔴 HIGH
  // -------------------------------
  let isHigh = false;

  if (daysNoInput != null && daysNoInput >= 14) {
    isHigh = true;
    reasons.push('未入力');
  }

  if (sharingOn && typeof acwr === 'number' && acwr >= 1.5) {
    isHigh = true;
    reasons.push('負荷急増');
  }

  if (sharingOn && typeof sleep === 'number' && sleep <= 5.0) {
    isHigh = true;
    reasons.push('睡眠↓');
  }

  if (isHigh) {
    return {
      id,
      name,
      riskLevel: 'high',
      reasons: pickTop2(reasons),
      acwr, // ✅ 追加
    };
  }

  // -------------------------------
  // 🟠 CAUTION
  // -------------------------------
  let isCaution = false;

  if (daysNoInput != null && daysNoInput >= 7) {
    isCaution = true;
    reasons.push('未入力');
  }

  if (sharingOn && typeof acwr === 'number' && acwr >= 1.3) {
    isCaution = true;
    reasons.push('負荷やや高');
  }

  if (sharingOn && typeof sleep === 'number' && sleep <= 5.5) {
    isCaution = true;
    reasons.push('睡眠↓');
  }

  if (isCaution) {
    return {
      id,
      name,
      riskLevel: 'caution',
      reasons: pickTop2(reasons),
      acwr, // ✅ 追加
    };
  }

  // -------------------------------
  // 🟢 LOW
  // -------------------------------
  return {
    id,
    name,
    riskLevel: 'low',
    reasons: [],
    acwr, // ✅ 追加
  };
}

// ===============================
// 🎨 表示用（UIロジック）
// ===============================
export function getRiskColor(risk?: RiskLevel) {
  switch (risk) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'caution':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export function getRiskLabel(risk?: RiskLevel) {
  switch (risk) {
    case 'high':
      return '高リスク';
    case 'caution':
      return '注意';
    case 'low':
      return '安定';
    default:
      return '不明';
  }
}



// ===============================
// 🔃 リスク順ソート（共通）
// ===============================
export function sortAthletesByRisk<T extends { id: string; name?: string }>(params: {
  athletes: T[];
  riskMap: Record<string, AthleteRisk | undefined>;
  weekCardMap?: Record<string, { is_sharing_active?: boolean } | undefined>;
}) {
  const { athletes, riskMap, weekCardMap = {} } = params;

  return [...athletes].sort((a, b) => {
    const aSharing = weekCardMap[a.id]?.is_sharing_active ?? true;
    const bSharing = weekCardMap[b.id]?.is_sharing_active ?? true;

    // ① 共有OFFは最後
    if (!aSharing && bSharing) return 1;
    if (aSharing && !bSharing) return -1;

    // ② リスク優先度
    const aRisk = riskMap[a.id]?.riskLevel;
    const bRisk = riskMap[b.id]?.riskLevel;

    const aScore = aRisk ? riskPriority[aRisk] : 0;
    const bScore = bRisk ? riskPriority[bRisk] : 0;

    if (aScore !== bScore) return bScore - aScore;

    const aRaw = riskMap[a.id]?.acwr;
    const bRaw = riskMap[b.id]?.acwr;

    // ③ 同リスク内は ACWR 降順（null/undefinedは最後）
    const aAcwr = typeof aRaw === 'number' && Number.isFinite(aRaw) ? aRaw : -Infinity;
    const bAcwr = typeof bRaw === 'number' && Number.isFinite(bRaw) ? bRaw : -Infinity;

    if (aAcwr !== bAcwr) return bAcwr - aAcwr;

    // ③ 理由が多い方
    const aReasons = riskMap[a.id]?.reasons.length ?? 0;
    const bReasons = riskMap[b.id]?.reasons.length ?? 0;

    if (aReasons !== bReasons) return bReasons - aReasons;

    // ④ 名前順（安定ソート）
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });
}