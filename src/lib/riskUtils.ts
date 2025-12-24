// src/lib/riskUtils.ts
export type RiskLevel = 'high' | 'medium' | 'low';

export type AthleteRisk = {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  reasons: string[]; // 最大2つ
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

const pickTop2 = (reasons: string[]) => Array.from(new Set(reasons)).slice(0, 2);

/**
 * 🧠 リスク判定ロジック（ビジネスロジック）
 */
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

  // --- High ---
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
    return { id, name, riskLevel: 'high', reasons: pickTop2(reasons) };
  }

  // --- Medium ---
  let isMedium = false;

  if (daysNoInput != null && daysNoInput >= 7) {
    isMedium = true;
    reasons.push('未入力');
  }

  if (sharingOn && typeof acwr === 'number' && acwr >= 1.3) {
    isMedium = true;
    reasons.push('負荷やや高');
  }

  if (sharingOn && typeof sleep === 'number' && sleep <= 5.5) {
    isMedium = true;
    reasons.push('睡眠↓');
  }

  if (isMedium) {
    return { id, name, riskLevel: 'medium', reasons: pickTop2(reasons) };
  }

  return { id, name, riskLevel: 'low', reasons: [] };
}

/**
 * 🎨 表示用（UIロジック）
 * AthleteView / StaffView 共通
 */
export function getRiskColor(risk?: RiskLevel) {
  switch (risk) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

/**
 * 🏷 表示用ラベル（UI）
 */
export function getRiskLabel(risk?: RiskLevel) {
  switch (risk) {
    case 'high':
      return '高リスク';
    case 'medium':
      return '注意';
    case 'low':
      return '安定';
    default:
      return '不明';
  }
}