import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { DailyCyclePoint } from '../hooks/useWeeklyGrowthCycle';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function loadToRadius(load: number, maxLoad: number) {
  if (!isFinite(load) || load <= 0) return 5;
  if (!isFinite(maxLoad) || maxLoad <= 0) return 5;
  const t = clamp(load / maxLoad, 0, 1);
  return 5 + t * 13; // 5〜18
}

export function WeeklyGrowthCycleView(props: { teamDaily: DailyCyclePoint[]; weekLabel: string }) {
  const { teamDaily, weekLabel } = props;

  const maxLoad = useMemo(() => {
    if (!teamDaily?.length) return 0;
    return Math.max(...teamDaily.map((d) => d.load ?? 0), 0);
  }, [teamDaily]);

  // マトリクス点（n=0は薄く）
  const matrixPoints = useMemo(() => {
    return (teamDaily ?? []).map((d) => ({
      ...d,
      name: d.n > 0 ? d.date : `${d.date}（データなし）`,
      opacity: d.n > 0 ? 0.55 : 0.12,
    }));
  }, [teamDaily]);

  // 折れ線用（n=0日は 0 をそのまま表示）
  const timeline = useMemo(() => {
    return (teamDaily ?? []).map((d) => ({
      date: d.date.slice(5), // "MM-DD"
      load: d.load,
      growth: d.y,
      understanding: d.x,
      n: d.n,
    }));
  }, [teamDaily]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
      <div>
        <div className="text-sm sm:text-base font-semibold text-gray-900">週サイクル（{weekLabel}）</div>
        <div className="text-xs text-gray-500">
          上：日別平均のマトリクス（点サイズ＝負荷 load） / 下：週の推移（load・成長・理解）
        </div>
      </div>

      {/* 上：週のマトリクス（7点） */}
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 14, bottom: 10, left: 10 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
            <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p: any = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow">
                    <div className="font-semibold mb-1">{p.date}</div>
                    <div className="text-sm">理解度: {Math.round(p.x)}</div>
                    <div className="text-sm">成長度: {Math.round(p.y)}</div>
                    <div className="text-sm">負荷(load): {Math.round(p.load)}</div>
                    <div className="text-sm">平均RPE: {p.rpe}</div>
                    <div className="text-sm">件数: {p.n}</div>
                  </div>
                );
              }}
            />
            <Legend />
            <Scatter
              name="日別平均"
              data={matrixPoints}
              fill="#3b82f6"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const r = loadToRadius(payload?.load ?? 0, maxLoad);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#3b82f6"
                    fillOpacity={payload?.opacity ?? 0.55}
                    stroke="#1d4ed8"
                    strokeWidth={1}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 下：週の推移（サイクル感） */}
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={timeline} margin={{ top: 10, right: 14, bottom: 10, left: 10 }}>
            <CartesianGrid />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="load" name="負荷(load)" />
            <Line type="monotone" dataKey="growth" name="成長(平均)" />
            <Line type="monotone" dataKey="understanding" name="理解(平均)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-gray-500">
        ※「成長/理解」は 0–100 の平均値。n=0 の日は点が薄く、loadは0になります。
      </div>
    </div>
  );
}