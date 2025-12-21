// src/components/InBodyCharts.tsx
import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { InbodyRecordLite } from '../hooks/useInbodyData';

function xLabel(d: string) {
  // YYYY-MM-DD -> M/D
  const dt = new Date(d + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function tooltipLabel(d: any) {
  const s = String(d);
  const dt = new Date(s + 'T00:00:00');
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleDateString('ja-JP');
}

export function InBodyCharts({
  records,
  loading,
  isDarkMode,
}: {
  records: InbodyRecordLite[];
  loading: boolean;
  isDarkMode: boolean;
}) {
  const data = records.map((r) => ({
    date: r.measured_at,
    weight: r.weight,
    pbf: r.body_fat_percent,
  }));

  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const axisStroke = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const tooltipBg = isDarkMode ? '#111827' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
  const tooltipColor = isDarkMode ? '#f9fafb' : '#111827';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
        InBody 推移
      </h3>

      {loading ? (
        <div className="flex items-center justify-center h-56">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          まだデータがありません
        </div>
      ) : (
        <div className="space-y-6">
          {/* 体重 */}
          <div className="h-56">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              体重（kg）
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis dataKey="date" tickFormatter={xLabel} stroke={axisStroke} />
                <YAxis stroke={axisStroke} />
                <Tooltip
                  labelFormatter={tooltipLabel}
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipColor }}
                />
                <Line type="monotone" dataKey="weight" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 体脂肪率 */}
          <div className="h-56">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              体脂肪率（%）
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke={gridStroke} />
                <XAxis dataKey="date" tickFormatter={xLabel} stroke={axisStroke} />
                <YAxis stroke={axisStroke} />
                <Tooltip
                  labelFormatter={tooltipLabel}
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, color: tooltipColor }}
                />
                <Line type="monotone" dataKey="pbf" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}