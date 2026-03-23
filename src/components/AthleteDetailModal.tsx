// src/components/AthleteDetailModal.tsx
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { X, Activity, Scale, BarChart2, User as UserIcon, Droplets, Snowflake, MessageSquare, Stethoscope } from 'lucide-react';
import { User, supabase } from '../lib/supabase';
import { useTrainingData } from '../hooks/useTrainingData';
import { AthleteRisk, getRiskColor, getRiskLabel } from '../lib/riskUtils';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import { getPhaseColor as getCyclePhaseColorUtil } from '../lib/cyclePhaseUtils';
import { useWeightData } from '../hooks/useWeightData';
import {
  ResponsiveContainer,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ComposedChart,
} from 'recharts';

interface AthleteDetailModalProps {
  athlete: User;
  onClose: () => void;
  risk?: AthleteRisk;
  weekCard?: { sleep_hours_avg?: number | null } | undefined;
  currentUserId?: string;
  canFreeze?: boolean;
  onFrozenChange?: () => void;
  onOpenMessage?: (athleteId: string) => void;
  onOpenRehabAssign?: (athleteId: string, injuryId?: string, purpose?: string) => void;
  onOpenPrescription?: (prescriptionId: string, athleteId: string) => void;
}

const AthletePerformanceProfileLazy = lazy(() => import('./AthletePerformanceProfile'));
const AthleteRehabTabLazy = lazy(() => import('./rehab/AthleteRehabTab'));

type TabKey = 'overview' | 'trends' | 'profile' | 'rehab';
type TrendPeriod = '1w' | '2w' | '1m' | '3m' | 'all';
type TrendMetric = 'rpe' | 'duration' | 'load' | 'weight' | 'acwr';

function getNextActions(risk: { riskLevel: 'high' | 'caution' | 'low'; reasons: string[]; acwr?: number | null }) {
  const reasons = risk.reasons || [];
  const hasNoInput = reasons.includes('未入力');
  const hasLoad = reasons.includes('負荷急増') || reasons.includes('負荷やや高');
  const hasSleep = reasons.includes('睡眠↓');

  if (risk.riskLevel === 'high') {
    return [
      hasNoInput ? '入力が止まっている理由を確認（体調/忙しさ/入力導線）' : '主観疲労・痛み・違和感の有無を確認',
      hasLoad ? '練習後RPEの確認＋次回は強度or量を一段落とす検討' : '今日〜明日の回復指標（睡眠/食欲/気分）を確認',
      hasSleep ? '今夜の睡眠確保（就寝時刻の提案・スマホ/カフェイン）' : '48時間の経過観察（症状があれば練習内容調整）',
    ];
  }

  if (risk.riskLevel === 'caution') {
    return [
      hasLoad ? '次回の負荷を微調整（量/強度のどちらかを軽く）' : '回復状況を一言ヒアリング',
      hasSleep ? '睡眠の確保（最低6h目標、就寝前ルーティン）' : '練習後のリカバリー（補食/入浴/ストレッチ）を促す',
      hasNoInput ? '入力の習慣づけ（タイミング固定：練習後/就寝前など）' : '状態が上向けば通常運用へ',
    ];
  }

  return [
    '状態は安定。良い習慣を継続',
    '良かった点を一言フィードバック（継続の強化）',
    '今週の目標を再確認して進める',
  ];
}

// ✅ YYYY-MM-DD を安全に取り出す（JSTズレ回避のため Date に通さない）
function toYMD(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') {
    const s = v.includes('T') ? v.split('T')[0] : v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatMD(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd || '';
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return ymd;
  return `${mm}/${dd}`;
}

function trend(delta: number | null) {
  if (delta == null || !Number.isFinite(delta)) {
    return { arrow: '–', tone: 'text-gray-500' };
  }
  if (delta > 0) return { arrow: '↑', tone: 'text-red-600' };
  if (delta < 0) return { arrow: '↓', tone: 'text-emerald-600' };
  return { arrow: '→', tone: 'text-gray-600' };
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AthleteDetailModal({ athlete, onClose, risk, weekCard, currentUserId, canFreeze, onFrozenChange, onOpenMessage, onOpenRehabAssign, onOpenPrescription }: AthleteDetailModalProps) {
  const td = useTrainingData(athlete.id);
  const wd = useWeightData(athlete.id);

  // 女性選手のみ月経周期データを取得
  const isFemale = athlete.gender === 'female' || athlete.gender === '女性';
  const cycleHook = useMenstrualCycleData(athlete.id);
  const cyclePhaseInfo = isFemale ? cycleHook.getCurrentPhaseInfo() : null;

  // 凍結/解除
  const [freezeConfirm, setFreezeConfirm] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const isFrozen = athlete.status === 'frozen';

  const handleToggleFreeze = async () => {
    setFreezeLoading(true);
    try {
      if (isFrozen) {
        await supabase.from('users').update({
          status: 'active',
          frozen_at: null,
          frozen_by: null,
        }).eq('id', athlete.id);
      } else {
        await supabase.from('users').update({
          status: 'frozen',
          frozen_at: new Date().toISOString(),
          frozen_by: currentUserId ?? null,
        }).eq('id', athlete.id);
      }
      onFrozenChange?.();
      setFreezeConfirm(false);
      onClose();
    } finally {
      setFreezeLoading(false);
    }
  };

  // ✅ undefined でも落ちないように正規化
  const records = Array.isArray(td?.records) ? td.records : [];
  const weightRecords = Array.isArray(wd?.records) ? wd.records : [];
  const loading = !!td?.loading||!!wd?.loading;

  // ✅ athlete_acwr_daily テーブルから取得（useTrainingData経由）
  const acwrDaily = useMemo(() => {
    return (td.acwrData ?? []).map((r: any) => ({
      date: r.date,
      daily_load: r.dailyLoad ?? 0,
      acwr: r.acwr,
    }));
  }, [td.acwrData]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('1m');
  const [trendMetrics, setTrendMetrics] = useState<Set<TrendMetric>>(new Set(['load', 'weight']));

  const toggleMetric = (metric: TrendMetric) => {
    setTrendMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size <= 1) return prev;
        next.delete(metric);
      } else {
        if (next.size >= 3) return prev;
        next.add(metric);
      }
      return next;
    });
  };

  // ===== DBのACWR（最新 / 前回） =====
  
  const latestRow = acwrDaily.length > 0 ? acwrDaily[acwrDaily.length - 1] : null;
  const prevRow = acwrDaily.length >= 2 ? acwrDaily[acwrDaily.length - 2] : null;

  const latestACWRValue = latestRow ? toNum((latestRow as any).acwr) : null;
  const prevACWRValue = prevRow ? toNum((prevRow as any).acwr) : null;

  const acwrDelta =
    latestACWRValue != null && prevACWRValue != null ? latestACWRValue - prevACWRValue : null;

  const acwrTrend = trend(acwrDelta);

  const displayACWR =
    latestACWRValue != null
      ? latestACWRValue
      : (typeof risk?.acwr === 'number' && Number.isFinite(risk.acwr) ? risk.acwr : null);

  const latestACWRDateLabel = latestRow?.date ? formatMD(toYMD((latestRow as any).date)) : '';

  // ===== 日次Load（DB）で「今週7日 vs 前週7日」 =====
  const load7AndPrev = useMemo(() => {
    const arr = Array.isArray(acwrDaily) ? acwrDaily : [];
    if (arr.length === 0) return { load7: null as number | null, loadPrev7: null as number | null };

    const loads = arr.map((r: any) => toNum(r?.daily_load) ?? 0);
    const last7 = loads.slice(-7);
    const prev7 = loads.slice(-14, -7);

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    const load7 = last7.length > 0 ? sum(last7) : null;
    const loadPrev7 = prev7.length > 0 ? sum(prev7) : null;

    return { load7, loadPrev7 };
  }, [acwrDaily]);

  const load7 = load7AndPrev.load7;
  const loadPrev7 = load7AndPrev.loadPrev7;

  const loadDelta =
    load7 != null && loadPrev7 != null ? load7 - loadPrev7 : null;

  const loadTrend = trend(loadDelta);

  // ✅ 表示の「直近7日Load（DBのacute_7d）」も欲しければここで取れる（カードはsum版でOK）
  // const latestAcute7d = latestRow ? toNum((latestRow as any).acute_7d) : null;

  // ===== 体重データ =====
  const weightChartData = useMemo(() => {
    const source = Array.isArray(weightRecords) ? weightRecords : [];

    return source
      .map((r: any) => {
        const w = r.weight_kg ?? r.weight ?? r.body_weight ?? null;
        const ymd = toYMD(r.date);
        if (!ymd) return null;

        const n = w != null ? Number(w) : null;
        if (n == null || !Number.isFinite(n)) return null;

        return {
          rawDate: ymd,
          date: formatMD(ymd),
          weight: n,
        };
      })
      .filter(Boolean) as { rawDate: string; date: string; weight: number }[];
  }, [weightRecords]);

  // ===== 体重 前回比 =====
  const latestWeight = weightChartData.length > 0 ? weightChartData[weightChartData.length - 1] : null;
  const prevWeight = weightChartData.length >= 2 ? weightChartData[weightChartData.length - 2] : null;

  const latestWeightValue = latestWeight?.weight != null && Number.isFinite(latestWeight.weight) ? latestWeight.weight : null;
  const prevWeightValue = prevWeight?.weight != null && Number.isFinite(prevWeight.weight) ? prevWeight.weight : null;

  const weightDelta =
    latestWeightValue != null && prevWeightValue != null ? latestWeightValue - prevWeightValue : null;

  const weightTrend = trend(weightDelta);

  // ===== 日次RPE（training_records を日付でまとめる：duration加重平均） =====
  const rpeByDay = useMemo(() => {
    const map: Record<string, number> = {};
    const sumDur: Record<string, number> = {};
    const sumRpeDur: Record<string, number> = {};

    (records || []).forEach((r: any) => {
      const ymd = toYMD(r?.date);
      if (!ymd) return;

      const rpe = toNum(r?.rpe ?? r?.session_rpe);
      const dur = toNum(r?.duration_min ?? r?.duration_minutes ?? r?.duration);

      if (rpe == null || dur == null || dur <= 0) return;

      sumDur[ymd] = (sumDur[ymd] ?? 0) + dur;
      sumRpeDur[ymd] = (sumRpeDur[ymd] ?? 0) + rpe * dur;
    });

    Object.keys(sumDur).forEach((ymd) => {
      const d = sumDur[ymd];
      const s = sumRpeDur[ymd] ?? 0;
      if (d > 0) map[ymd] = s / d;
    });

    return map;
  }, [records]);

  // ===== 日次 練習時間（training_records を日付でまとめる） =====
  const durationByDay = useMemo(() => {
    const map: Record<string, number> = {};
    (records || []).forEach((r: any) => {
      const ymd = toYMD(r?.date);
      if (!ymd) return;
      const dur = toNum(r?.duration_min ?? r?.duration_minutes ?? r?.duration);
      if (dur == null || dur <= 0) return;
      map[ymd] = (map[ymd] ?? 0) + dur;
    });
    return map;
  }, [records]);

  // ===== DB日次 series → チャート用（load/acwr + rpe + duration） =====
  const dailyChartData = useMemo(() => {
    const src = Array.isArray(acwrDaily) ? acwrDaily : [];
    if (src.length === 0) return [];

    const result = src
      .map((d: any) => {
        const ymd = toYMD(d?.date);
        if (!ymd) return null;

        const load = toNum(d?.daily_load);
        const acwr = toNum(d?.acwr);
        const rpe = rpeByDay[ymd] != null ? rpeByDay[ymd] : null;

        // 0埋めを活かすなら load は null ではなく 0 にしてもOK（ここは表示都合）
        const duration = durationByDay[ymd] != null ? durationByDay[ymd] : null;
        return {
          rawDate: ymd,
          date: formatMD(ymd),
          load: load ?? 0,
          acwr,
          rpe,
          duration,
        };
      })
      .filter(Boolean) as { rawDate: string; date: string; load: number; acwr: number | null; rpe: number | null; duration: number | null }[];

    return result;
  }, [acwrDaily, rpeByDay]);

  // ===== weightタブ用（負荷 + 体重）にマージ（負荷は日次load） =====
  const loadWeightMergedData = useMemo(() => {
    const map = new Map<string, any>();

    for (const r of dailyChartData) {
      map.set(r.rawDate, { ...r });
    }

    for (const w of weightChartData) {
      const prev = map.get(w.rawDate) ?? { rawDate: w.rawDate, date: w.date };
      map.set(w.rawDate, { ...prev, weight: w.weight, date: prev.date ?? w.date });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.rawDate < b.rawDate ? -1 : a.rawDate > b.rawDate ? 1 : 0));
    return arr;
  }, [dailyChartData, weightChartData]);

  // ===== データ推移タブ：期間フィルタリング =====
  const filteredTrendData = useMemo(() => {
    const data = loadWeightMergedData;
    if (trendPeriod === 'all' || data.length === 0) return data;

    const daysMap: Record<string, number> = { '1w': 7, '2w': 14, '1m': 30, '3m': 90 };
    const days = daysMap[trendPeriod] || 30;

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    const startStr = startDate.toISOString().slice(0, 10);

    return data.filter((d: any) => d.rawDate >= startStr);
  }, [loadWeightMergedData, trendPeriod]);

  // ===== データ推移タブ：動的Y軸ドメイン =====
  const trendAxisDomains = useMemo(() => {
    const data = filteredTrendData;
    // 左軸: load (bar)
    const leftMax = Math.max(1, ...data.map((d: any) => d.load ?? 0));

    // 右軸: 選択された指標の最大値に基づく
    let rightMax = 0;
    if (trendMetrics.has('rpe')) rightMax = Math.max(rightMax, 10);
    if (trendMetrics.has('acwr')) {
      const maxAcwr = Math.max(0, ...data.map((d: any) => d.acwr ?? 0));
      rightMax = Math.max(rightMax, maxAcwr * 1.2);
    }
    if (trendMetrics.has('weight')) {
      const maxW = Math.max(0, ...data.map((d: any) => d.weight ?? 0));
      rightMax = Math.max(rightMax, maxW * 1.05);
    }
    if (trendMetrics.has('duration')) {
      const maxD = Math.max(0, ...data.map((d: any) => d.duration ?? 0));
      rightMax = Math.max(rightMax, maxD * 1.1);
    }
    if (rightMax === 0) rightMax = 10;

    // 右軸の最小値（体重が選択されている場合はゼロから始めると見づらい）
    let rightMin = 0;
    if (trendMetrics.has('weight') && !trendMetrics.has('rpe') && !trendMetrics.has('acwr') && !trendMetrics.has('duration')) {
      const minW = Math.min(Infinity, ...data.filter((d: any) => d.weight != null).map((d: any) => d.weight));
      if (Number.isFinite(minW)) rightMin = Math.floor(minW * 0.95);
    }

    return {
      leftDomain: [0, Math.ceil(leftMax * 1.1)] as [number, number],
      rightDomain: [rightMin, Math.ceil(rightMax)] as [number, number],
    };
  }, [filteredTrendData, trendMetrics]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-5xl w-full h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 sm:p-6 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 truncate">
              <Activity className="w-4 h-4 flex-shrink-0" />
              {athlete.nickname || athlete.name || '選手'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenMessage && (
              <button
                onClick={() => onOpenMessage(athlete.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-white/10 hover:bg-white/20 text-blue-100"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                メッセージ
              </button>
            )}
            {canFreeze && (
              <button
                onClick={() => setFreezeConfirm(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isFrozen
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-100'
                    : 'bg-white/10 hover:bg-white/20 text-blue-100'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                {isFrozen ? '凍結解除' : '凍結する'}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 凍結確認ダイアログ */}
        {freezeConfirm && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-4">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
              {isFrozen
                ? `${athlete.name} の凍結を解除しますか？選手一覧に復帰します。`
                : `${athlete.name} を凍結しますか？選手一覧から非表示になり、本人は読み取り専用になります。`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggleFreeze}
                disabled={freezeLoading}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors ${
                  isFrozen
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {freezeLoading ? '処理中...' : isFrozen ? '解除する' : '凍結する'}
              </button>
              <button
                onClick={() => setFreezeConfirm(false)}
                className="px-4 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* ✅ 状態バー（コンパクト） */}
        {risk && (
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getRiskColor(risk.riskLevel)}`}>
              {getRiskLabel(risk.riskLevel)}
            </span>
            {displayACWR != null && (
              <span className="text-[11px] text-gray-500">ACWR <b>{displayACWR.toFixed(2)}</b></span>
            )}
            {risk.reasons?.length > 0 && risk.reasons.slice(0, 2).map((r) => (
              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r}</span>
            ))}
          </div>
        )}

        {/* タブ */}
        <div className="border-b border-gray-200 px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar text-xs sm:text-sm">
            {[
              { key: 'overview', label: '概要', color: 'blue' },
              { key: 'trends', label: 'データ推移', color: 'purple', icon: BarChart2 },
              { key: 'profile', label: 'プロフィール', color: 'indigo', icon: UserIcon },
              ...(onOpenRehabAssign ? [{ key: 'rehab', label: 'リハ', color: 'orange', icon: Stethoscope }] : []),
            ].map(({ key, label, color, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-1 px-3 py-2.5 border-b-2 whitespace-nowrap font-medium transition-colors ${
                  activeTab === key
                    ? `border-${color}-500 text-${color}-600 font-semibold`
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 本体 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* --- 概要タブ --- */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-700 mb-1">最新 ACWR（DB）</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {latestACWRValue != null ? latestACWRValue.toFixed(2) : '--'}
                  </p>

                  <div className="mt-1 text-xs flex items-center gap-2">
                    <span className={`${acwrTrend.tone} font-semibold`}>{acwrTrend.arrow}</span>
                    <span className="text-gray-600">
                      前回比：
                      <b className="ml-1">
                        {acwrDelta != null ? `${acwrDelta >= 0 ? '+' : ''}${acwrDelta.toFixed(2)}` : '--'}
                      </b>
                    </span>
                  </div>

                  {latestRow?.date && <p className="text-xs text-blue-700 mt-1">{latestACWRDateLabel}</p>}
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-700 mb-1">直近7日間（0埋め）</p>
                  <p className="text-2xl font-bold text-green-900">{Math.min(acwrDaily.length, 7)}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-700 mb-1">総セッション数</p>
                  <p className="text-2xl font-bold text-gray-900">{records.length}</p>
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-700 mb-1">最新 体重</p>
                  <p className="text-2xl font-bold text-green-900">
                    {latestWeightValue != null ? latestWeightValue.toFixed(1) : '--'}
                  </p>

                  <div className="mt-1 text-xs flex items-center gap-2">
                    <span className={`${weightTrend.tone} font-semibold`}>{weightTrend.arrow}</span>
                    <span className="text-gray-600">
                      前回比：
                      <b className="ml-1">
                        {weightDelta != null ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)}kg` : '--'}
                      </b>
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-700 mb-1">直近7日 Load（DB日次）</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {load7 != null ? Math.round(load7) : '--'}
                  </p>

                  <div className="mt-1 text-xs flex items-center gap-2">
                    <span className={`${loadTrend.tone} font-semibold`}>{loadTrend.arrow}</span>
                    <span className="text-gray-600">
                      前週比：
                      <b className="ml-1">
                        {loadDelta != null ? `${loadDelta >= 0 ? '+' : ''}${Math.round(loadDelta)}` : '--'}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              {/* コンディションフェーズ（女性選手のみ・抽象表現） */}
              {isFemale && cyclePhaseInfo && (() => {
                const phaseConfig: Record<string, { label: string; tip: string; bg: string; text: string; border: string }> = {
                  menstrual: { label: '回復フェーズ', tip: '負荷軽減を推奨', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
                  follicular: { label: 'アクティブフェーズ', tip: '高強度トレーニングに適した時期', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
                  ovulatory: { label: 'ピークフェーズ', tip: 'パフォーマンスが最も高い時期', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
                  luteal: { label: 'ケアフェーズ', tip: '怪我リスクに注意。負荷調整を推奨', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
                };
                const cfg = phaseConfig[cyclePhaseInfo.phase] || phaseConfig.follicular;
                return (
                  <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 flex items-center gap-3`}>
                    <Activity className={`w-5 h-5 ${cfg.text}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                        {cfg.tip}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* --- データ推移タブ（統合） --- */}
          {activeTab === 'trends' && (
            <div className="space-y-3">
              {/* 期間セレクター（iOS風セグメントコントロール） */}
              <div className="flex rounded-lg bg-gray-100 p-0.5">
                {([
                  { key: '1w' as TrendPeriod, label: '1W' },
                  { key: '2w' as TrendPeriod, label: '2W' },
                  { key: '1m' as TrendPeriod, label: '1M' },
                  { key: '3m' as TrendPeriod, label: '3M' },
                  { key: 'all' as TrendPeriod, label: '全' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTrendPeriod(key)}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                      trendPeriod === key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 指標トグルチップ */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'load' as TrendMetric, label: '負荷', color: '#60a5fa', bgActive: 'bg-blue-100', textActive: 'text-blue-700', borderActive: 'border-blue-300' },
                  { key: 'weight' as TrendMetric, label: '体重', color: '#22c55e', bgActive: 'bg-green-100', textActive: 'text-green-700', borderActive: 'border-green-300' },
                  { key: 'rpe' as TrendMetric, label: 'RPE', color: '#f97316', bgActive: 'bg-orange-100', textActive: 'text-orange-700', borderActive: 'border-orange-300' },
                  { key: 'acwr' as TrendMetric, label: 'ACWR', color: '#a855f7', bgActive: 'bg-purple-100', textActive: 'text-purple-700', borderActive: 'border-purple-300' },
                  { key: 'duration' as TrendMetric, label: '時間', color: '#06b6d4', bgActive: 'bg-cyan-100', textActive: 'text-cyan-700', borderActive: 'border-cyan-300' },
                ]).map(({ key, label, color, bgActive, textActive, borderActive }) => {
                  const isActive = trendMetrics.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleMetric(key)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isActive
                          ? `${bgActive} ${textActive} ${borderActive} font-medium`
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? color : '#d1d5db' }} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* グラフ */}
              {filteredTrendData.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">この期間のデータがありません。</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredTrendData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />

                      {/* 左軸: 負荷 (Bar) */}
                      {trendMetrics.has('load') && (
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          tick={{ fontSize: 10 }}
                          domain={trendAxisDomains.leftDomain}
                          tickFormatter={(v: number) => `${Math.round(v)}`}
                          width={35}
                        />
                      )}

                      {/* 右軸: その他のLine指標 */}
                      {(trendMetrics.has('rpe') || trendMetrics.has('acwr') || trendMetrics.has('weight') || trendMetrics.has('duration')) && (
                        <YAxis
                          yAxisId="right"
                          orientation={trendMetrics.has('load') ? 'right' : 'left'}
                          tick={{ fontSize: 10 }}
                          domain={trendAxisDomains.rightDomain}
                          tickFormatter={(v: number) => v >= 10 ? `${Math.round(v)}` : v.toFixed(1)}
                          width={35}
                        />
                      )}

                      <Tooltip
                        contentStyle={{ fontSize: 11, padding: '6px 10px' }}
                        formatter={(value: any, name: any) => {
                          if (typeof value !== 'number') return [value, name];
                          if (name === 'ACWR') return [value.toFixed(2), name];
                          if (name === 'RPE') return [value.toFixed(1), name];
                          if (name === '体重') return [`${value.toFixed(1)}kg`, name];
                          if (name === '時間') return [`${Math.round(value)}分`, name];
                          return [Math.round(value), name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />

                      {/* Bar: 日次負荷 */}
                      {trendMetrics.has('load') && (
                        <Bar
                          yAxisId="left"
                          dataKey="load"
                          name="負荷"
                          fill="#60a5fa"
                          opacity={0.7}
                          radius={[2, 2, 0, 0]}
                        />
                      )}

                      {/* Line: 体重 */}
                      {trendMetrics.has('weight') && (
                        <Line
                          yAxisId={trendMetrics.has('load') ? 'right' : 'right'}
                          type="monotone"
                          dataKey="weight"
                          name="体重"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#22c55e' }}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      )}

                      {/* Line: RPE */}
                      {trendMetrics.has('rpe') && (
                        <Line
                          yAxisId={trendMetrics.has('load') ? 'right' : 'right'}
                          type="monotone"
                          dataKey="rpe"
                          name="RPE"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#f97316' }}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      )}

                      {/* Line: ACWR */}
                      {trendMetrics.has('acwr') && (
                        <Line
                          yAxisId={trendMetrics.has('load') ? 'right' : 'right'}
                          type="monotone"
                          dataKey="acwr"
                          name="ACWR"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#a855f7' }}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      )}

                      {/* Line: 練習時間 */}
                      {trendMetrics.has('duration') && (
                        <Line
                          yAxisId={trendMetrics.has('load') ? 'right' : 'right'}
                          type="monotone"
                          dataKey="duration"
                          name="時間"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#06b6d4' }}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      )}

                      {/* ACWR リファレンスライン */}
                      {trendMetrics.has('acwr') && (
                        <>
                          <ReferenceLine yAxisId={trendMetrics.has('load') ? 'right' : 'right'} y={0.8} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1} ifOverflow="extendDomain" />
                          <ReferenceLine yAxisId={trendMetrics.has('load') ? 'right' : 'right'} y={1.3} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1} ifOverflow="extendDomain" />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* データ情報 */}
              <p className="text-xs text-gray-400 text-center">
                {filteredTrendData.length}日分 | {trendMetrics.size}項目選択中
              </p>
            </div>
          )}

          {/* --- プロフィールタブ --- */}
          {activeTab === 'profile' && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
              }
            >
              <AthletePerformanceProfileLazy userId={athlete.id} />
            </Suspense>
          )}

          {/* --- リハビリタブ --- */}
          {activeTab === 'rehab' && onOpenRehabAssign && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
                </div>
              }
            >
              <AthleteRehabTabLazy
                athleteId={athlete.id}
                onOpenAssign={(athleteId, injuryId, purpose) => onOpenRehabAssign(athleteId, injuryId, purpose)}
                onOpenPrescription={onOpenPrescription ? (presId, athId) => {
                  onClose();
                  onOpenPrescription(presId, athId);
                } : undefined}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}