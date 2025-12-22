// src/components/InBodyCharts.tsx
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import type { InbodyRecordLite } from '../hooks/useInbodyData';

type Gender = 'male' | 'female' | null;

type Props = {
  records: InbodyRecordLite[];
  gender: Gender; // AthleteView から user.gender を渡す（未設定は null）
};

function jpDate(d: string) {
  const s = String(d || '').trim();
  if (!s) return '';
  const normalized = s.includes('T') ? s : s.replace(/\//g, '-');
  const dt = new Date(normalized + (normalized.includes('T') ? '' : 'T00:00:00'));
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleDateString('ja-JP');
}

function toHeightM(heightCm: number | null | undefined) {
  if (heightCm == null) return null;
  const n = Number(heightCm);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 100;
}

function calcBMI(weightKg: number | null, heightCm: number | null) {
  const hm = toHeightM(heightCm);
  if (weightKg == null || hm == null) return null;
  const v = weightKg / (hm * hm);
  return Number.isFinite(v) ? v : null;
}

function calcFFMI(ffmKg: number | null, heightCm: number | null) {
  const hm = toHeightM(heightCm);
  if (ffmKg == null || hm == null) return null;
  const v = ffmKg / (hm * hm);
  return Number.isFinite(v) ? v : null;
}

function round2(v: number | null) {
  if (v == null) return null;
  const n = Math.round(v * 100) / 100;
  return Number.isFinite(n) ? n : null;
}
function round1(v: number | null) {
  if (v == null) return null;
  const n = Math.round(v * 10) / 10;
  return Number.isFinite(n) ? n : null;
}

type BandKey = 'general' | 'athlete';
type Bands = {
  bmi: { low: number; high: number };
  pbf: { low: number; high: number };
};

// ※数値は仮のデフォルト（あとでチューニングしやすいようにここに集約）
const BANDS: Record<BandKey, Record<'male' | 'female', Bands>> = {
    general: {
      male: {
        bmi: { low: 18.5, high: 25.0 },
        pbf: { low: 12, high: 20 },
      },
      female: {
        bmi: { low: 18.5, high: 25.0 },
        pbf: { low: 20, high: 30 },
      },
    },
    athlete: {
      male: {
        bmi: { low: 20.0, high: 27.0 },
        pbf: { low: 8, high: 15 },
      },
      female: {
        bmi: { low: 18.0, high: 25.0 },
        pbf: { low: 18, high: 25 },
      },
    },
  };

export function InBodyCharts({ records, gender }: Props) {
  const [showBands, setShowBands] = useState(true);
  const [bandKey, setBandKey] = useState<BandKey>('general');

  // 未設定なら強制OFF（ユーザー要望）
  const bandsEnabled = showBands && (gender === 'male' || gender === 'female');
  const bands = useMemo(() => {
    if (!bandsEnabled) return null;
    return BANDS[bandKey][gender as 'male' | 'female'];
  }, [bandsEnabled, bandKey, gender]);

  const heightFallbackCm = useMemo(() => {
    const sorted = [...(records ?? [])].sort((a, b) => (a.measured_at > b.measured_at ? 1 : -1));
    for (let i = sorted.length - 1; i >= 0; i--) {
      const h = sorted[i]?.height;
      if (h != null && Number.isFinite(h)) return h;
    }
    return null;
  }, [records]);

  const trendData = useMemo(() => {
    const sorted = [...(records ?? [])].sort((a, b) => (a.measured_at > b.measured_at ? 1 : -1));
    return sorted.map((r) => {
      const heightCm = (r.height ?? heightFallbackCm) as number | null;

      const weight = r.weight ?? null;
      const ffm = (r as any).fat_free_mass ?? null; // hook側で算出済み
      const pbf = r.body_fat_percent ?? null;

      const ffmi = round2(calcFFMI(ffm, heightCm));

      return {
        date: r.measured_at,
        dateLabel: jpDate(r.measured_at),

        // 左軸
        weight: round1(weight),
        fat_free_mass: round1(ffm),

        // 右軸
        body_fat_percent: round1(pbf),
        ffmi,
      };
    });
  }, [records, heightFallbackCm]);

  const matrixData = useMemo(() => {
    const sorted = [...(records ?? [])].sort((a, b) => (a.measured_at > b.measured_at ? 1 : -1));
    return sorted
      .map((r, idx) => {
        const heightCm = (r.height ?? heightFallbackCm) as number | null;
        const pbf = r.body_fat_percent ?? null;
        const bmi = calcBMI(r.weight ?? null, heightCm);

        return {
          idx,
          date: r.measured_at,
          dateLabel: jpDate(r.measured_at),
          pbf: round1(pbf),
          bmi: round2(bmi),
        };
      })
      .filter((p) => p.pbf != null && p.bmi != null);
  }, [records, heightFallbackCm]);

  const hasAnyTrend = trendData.some(
    (d) => d.weight != null || d.fat_free_mass != null || d.body_fat_percent != null || d.ffmi != null
  );

  return (
    <div className="space-y-6">
      {/* ① 推移グラフ（左右2軸） */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              InBody 推移（左右2軸）
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              左：体重 / 除脂肪量　右：体脂肪率 / FFMI（右軸の最小は0）
            </p>
          </div>
        </div>

        {!hasAnyTrend ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            表示できるデータがありません（体重/体脂肪率/身長が必要です）
          </div>
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={52} domain={['auto', 'auto']} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  width={52}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const n = typeof value === 'number' ? value : null;
                    if (n == null) return ['—', name];

                    if (name === 'weight') return [`${n.toFixed(1)} kg`, '体重'];
                    if (name === 'fat_free_mass') return [`${n.toFixed(1)} kg`, '除脂肪量'];
                    if (name === 'body_fat_percent') return [`${n.toFixed(1)} %`, '体脂肪率'];
                    if (name === 'ffmi') return [`${n.toFixed(2)}`, 'FFMI'];
                    return [String(value), name];
                  }}
                  labelFormatter={(label) => `測定日：${label}`}
                />
                <Legend />

                {/* 左軸 */}
                <Line type="monotone" dataKey="weight" name="体重" yAxisId="left" dot={{ r: 2 }} connectNulls />
                <Line
                  type="monotone"
                  dataKey="fat_free_mass"
                  name="除脂肪量"
                  yAxisId="left"
                  dot={{ r: 2 }}
                  connectNulls
                />

                {/* 右軸 */}
                <Line
                  type="monotone"
                  dataKey="body_fat_percent"
                  name="体脂肪率"
                  yAxisId="right"
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line type="monotone" dataKey="ffmi" name="FFMI" yAxisId="right" dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ② マトリクス（散布図） + 帯 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              マトリクス（BMI × 体脂肪率）
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              横：体脂肪率（%）　縦：BMI
            </p>
          </div>

          {/* 切り替えUI */}
          <div className="flex flex-col items-end gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                className="rounded"
                checked={showBands}
                onChange={(e) => setShowBands(e.target.checked)}
              />
              帯を表示
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">基準</span>
              <select
                className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                value={bandKey}
                onChange={(e) => setBandKey(e.target.value as BandKey)}
                disabled={!bandsEnabled} // 未設定の時はOFF扱い
              >
                <option value="general">一般</option>
                <option value="athlete">競技者</option>
              </select>
            </div>

            {/* 性別ステータス */}
            {gender !== 'male' && gender !== 'female' ? (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                性別未設定のため帯はOFF
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                性別：{gender === 'male' ? '男性' : '女性'}
              </div>
            )}
          </div>
        </div>

        {matrixData.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            散布図に必要なデータがありません（体重・身長・体脂肪率が必要です）
          </div>
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  dataKey="pbf"
                  name="体脂肪率"
                  unit="%"
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <YAxis type="number" dataKey="bmi" name="BMI" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />

                {/* 帯（ReferenceArea） */}
                    {bandsEnabled && bands && (
                    <ReferenceArea
                        x1={bands.pbf.low}
                        x2={bands.pbf.high}
                        y1={bands.bmi.low}
                        y2={bands.bmi.high}
                        fill="rgba(59,130,246,0.18)"
                        fillOpacity={1}
                        stroke="rgba(59,130,246,0.9)"
                        strokeWidth={1.5}
                        ifOverflow="extendDomain"
                    />
                    )}
                    {/* 帯（ReferenceArea）＋境界線＋数値ラベル */}
                    {bandsEnabled && bands && (
                    <>
                        {/* 帯（面） */}
                        <ReferenceArea
                        x1={bands.pbf.low}
                        x2={bands.pbf.high}
                        y1={bands.bmi.low}
                        y2={bands.bmi.high}
                        fill="rgba(59,130,246,0.12)"   // ✅ 見えるように明示（青薄）
                        stroke="rgba(59,130,246,0.55)"
                        strokeWidth={1}
                        />

                        {/* x方向：体脂肪率の境界（縦線） */}
                        <ReferenceLine
                        x={bands.pbf.low}
                        stroke="rgba(59,130,246,0.75)"
                        strokeDasharray="4 4"
                        label={{
                            value: `PBF ${bands.pbf.low}%`,
                            position: 'insideTopLeft',
                            fontSize: 11,
                        }}
                        />
                        <ReferenceLine
                        x={bands.pbf.high}
                        stroke="rgba(59,130,246,0.75)"
                        strokeDasharray="4 4"
                        label={{
                            value: `PBF ${bands.pbf.high}%`,
                            position: 'insideTopRight',
                            fontSize: 11,
                        }}
                        />

                        {/* y方向：BMIの境界（横線） */}
                        <ReferenceLine
                        y={bands.bmi.low}
                        stroke="rgba(59,130,246,0.75)"
                        strokeDasharray="4 4"
                        label={{
                            value: `BMI ${bands.bmi.low}`,
                            position: 'insideLeft',
                            fontSize: 11,
                        }}
                        />
                        <ReferenceLine
                        y={bands.bmi.high}
                        stroke="rgba(59,130,246,0.75)"
                        strokeDasharray="4 4"
                        label={{
                            value: `BMI ${bands.bmi.high}`,
                            position: 'insideLeft',
                            fontSize: 11,
                        }}
                        />
                    </>
                    )}

                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: any, name: any) => {
                    const n = typeof value === 'number' ? value : null;
                    if (name === 'pbf') return [`${n?.toFixed(1)} %`, '体脂肪率'];
                    if (name === 'bmi') return [`${n?.toFixed(2)}`, 'BMI'];
                    return [String(value), name];
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload;
                    return p?.dateLabel ? `測定日：${p.dateLabel}` : '';
                  }}
                />

                <Scatter name="過去→最新" data={matrixData} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}