import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { useDailyGrowthMatrix } from '../hooks/useDailyGrowthMatrix';
import type { MatrixPoint } from '../hooks/useDailyGrowthMatrix';

type AthleteLite = {
  id: string;
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function loadToRadius(load: number, maxLoad: number) {
  if (!isFinite(load) || load <= 0) return 6;
  if (!isFinite(maxLoad) || maxLoad <= 0) return 6;
  const t = clamp(load / maxLoad, 0, 1);
  return 6 + t * 12;
}

const StarShape = (props: any) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={18}>
      ★
    </text>
  );
};

type Props = {
  date: string; // YYYY-MM-DD
  athletes: AthleteLite[];
  title?: string;
};

export function GrowthUnderstandingMatrix({ date, athletes, title }: Props) {
  const { points, teamAvg, loading, error } = useDailyGrowthMatrix({ date, athletes });

  const safePoints: MatrixPoint[] = Array.isArray(points) ? points : [];

  const maxLoad = useMemo(() => {
    if (!safePoints.length) return 0;
    return Math.max(...safePoints.map((p) => (typeof p.load === 'number' ? p.load : 0)), 0);
  }, [safePoints]);

  const teamPoint = teamAvg
    ? [
        {
          x: teamAvg.x,
          y: teamAvg.y,
          name: 'チーム平均',
          load: teamAvg.load,
          rpe: null,
          duration_min: null,
        },
      ]
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-900">
            {title ?? '成長度 × 理解度 × 負荷（sRPE）'}
          </div>
          <div className="text-xs text-gray-500">
            点の大きさ＝load（RPE×時間） / ★＝チーム平均 / 50ラインで4象限
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>対象日：{date}</div>
          <div>点数：{safePoints.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div style={{ width: '100%', height: 420 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 10 }}>
              <CartesianGrid />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                label={{
                  value: '理解度（intent_signal / signal_score）',
                  position: 'insideBottom',
                  offset: -5,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                label={{
                  value: '成長度（growth_vector / arrow_score）',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />

              <ReferenceLine x={50} strokeDasharray="4 4" />
              <ReferenceLine y={50} strokeDasharray="4 4" />

              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p: any = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow">
                      <div className="font-semibold mb-1">{p.name}</div>
                      <div className="text-sm">理解度: {Math.round(p.x)}</div>
                      <div className="text-sm">成長度: {Math.round(p.y)}</div>
                      <div className="text-sm">負荷(load): {Math.round(p.load)}</div>
                      {typeof p.rpe === 'number' && <div className="text-sm">RPE: {p.rpe}</div>}
                      {typeof p.duration_min === 'number' && (
                        <div className="text-sm">時間: {p.duration_min}分</div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend />

              <Scatter
                name="選手"
                data={safePoints}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const r = loadToRadius(payload?.load ?? 0, maxLoad);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="#3b82f6"
                      fillOpacity={0.55}
                      stroke="#1d4ed8"
                      strokeWidth={1}
                    />
                  );
                }}
              />

              <Scatter name="チーム平均" data={teamPoint} shape={<StarShape />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default GrowthUnderstandingMatrix;