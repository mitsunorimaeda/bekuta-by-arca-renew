// src/components/AthleteDetailModal.tsx
import React, { useMemo, useState } from 'react';
import { X, Activity, Scale, BarChart2 } from 'lucide-react';
import { User } from '../lib/supabase';
import { useTrainingData } from '../hooks/useTrainingData';
import { AthleteRisk, getRiskColor, getRiskLabel } from '../lib/riskUtils';
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
  weekCard?: { is_sharing_active?: boolean; sleep_hours_avg?: number | null } | undefined;
}

type TabKey = 'overview' | 'weight' | 'rpe';

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

export function AthleteDetailModal({ athlete, onClose, risk, weekCard }: AthleteDetailModalProps) {
  const { records, weightRecords, acwrDaily, loading } = useTrainingData(athlete.id);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

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

  // ===== DB日次 series → チャート用（load/acwr + rpe(任意)） =====
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
        return {
          rawDate: ymd,
          date: formatMD(ymd),
          load: load ?? 0,
          acwr,
          rpe,
        };
      })
      .filter(Boolean) as { rawDate: string; date: string; load: number; acwr: number | null; rpe: number | null }[];

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

  const rightMax = useMemo(() => {
    const maxAcwr = Math.max(
      0,
      ...(dailyChartData.map((d) => (d.acwr != null ? d.acwr : 0)))
    );
    // RPE(0-10) と同軸なので、最低10は確保してACWRがそれ以上なら広げる
    return Math.max(10, Math.ceil(maxAcwr * 1.2 * 10) / 10);
  }, [dailyChartData]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {athlete.nickname || athlete.name || '選手'}
            </h2>
            <p className="text-sm text-blue-100 mt-1">{athlete.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ✅ 状態 → 原因 → 次の一手 */}
        {risk && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full border ${getRiskColor(risk.riskLevel)}`}>
                    {getRiskLabel(risk.riskLevel)}
                  </span>

                  {displayACWR != null && (
                    <span className="text-xs text-gray-600">
                      ACWR <b>{displayACWR.toFixed(2)}</b>
                    </span>
                  )}

                  {weekCard?.is_sharing_active === false && (
                    <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
                      🔒 共有OFF
                    </span>
                  )}
                </div>

                {risk.reasons?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {risk.reasons.slice(0, 2).map((r) => (
                      <span key={r} className="text-[11px] px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-800">
              <div className="font-semibold mb-1">次の一手</div>
              <ul className="list-disc pl-5 space-y-1">
                {getNextActions(risk).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="border-b border-gray-200 px-6 pt-3">
          <div className="flex gap-4 overflow-x-auto text-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              概要
            </button>
            <button
              onClick={() => setActiveTab('weight')}
              className={`pb-3 border-b-2 flex items-center gap-1 ${
                activeTab === 'weight'
                  ? 'border-green-500 text-green-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Scale className="w-4 h-4" />
              体重推移
            </button>
            <button
              onClick={() => setActiveTab('rpe')}
              className={`pb-3 border-b-2 flex items-center gap-1 ${
                activeTab === 'rpe'
                  ? 'border-purple-500 text-purple-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              RPE / 負荷 / ACWR
            </button>
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
            </div>
          )}

          {/* --- 体重タブ --- */}
          {activeTab === 'weight' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-green-500" />
                体重推移 ＋ 日次負荷（DB）
              </h3>

              <p className="text-xs text-gray-500">
                体重：{weightChartData.length}件 / 日次：{dailyChartData.length}日
              </p>

              {loadWeightMergedData.length === 0 ? (
                <p className="text-sm text-gray-500">データがまだありません。</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={loadWeightMergedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />

                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${Math.round(v)}`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${v.toFixed(1)}`}
                      />

                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (typeof value !== 'number') return value;
                          if (name === '体重') return [value.toFixed(1), name];
                          return [Math.round(value), name];
                        }}
                      />
                      <Legend />

                      <Bar
                        yAxisId="left"
                        dataKey="load"
                        name="日次負荷（daily_load）"
                        fill="#60a5fa"
                        opacity={0.85}
                      />

                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="weight"
                        name="体重"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* --- RPE / 負荷 / ACWR タブ --- */}
          {activeTab === 'rpe' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                日次負荷（DB）・RPE（日次）・ACWR（DB）
              </h3>

              <p className="text-xs text-gray-500">日次：{dailyChartData.length} 日</p>

              {dailyChartData.length === 0 ? (
                <p className="text-sm text-gray-500">日次データがまだありません。</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />

                      {/* 左：負荷 */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${Math.round(v)}`}
                      />
                      {/* 右：RPE/ACWR（同軸） */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        domain={[0, rightMax]}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />

                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (typeof value !== 'number') return value;
                          if (name === 'ACWR') return [value.toFixed(2), name];
                          if (name === 'RPE') return [value.toFixed(1), name];
                          return [Math.round(value), name];
                        }}
                      />
                      <Legend />

                      <Bar
                        yAxisId="left"
                        dataKey="load"
                        name="日次負荷（daily_load）"
                        fill="#60a5fa"
                        opacity={0.85}
                      />

                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rpe"
                        name="RPE（日次・duration加重）"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />

                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="acwr"
                        name="ACWR（DB）"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />

                      <ReferenceLine yAxisId="right" y={0.8} stroke="#22c55e" strokeDasharray="4 4" ifOverflow="extendDomain" />
                      <ReferenceLine yAxisId="right" y={1.3} stroke="#f97316" strokeDasharray="4 4" ifOverflow="extendDomain" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}