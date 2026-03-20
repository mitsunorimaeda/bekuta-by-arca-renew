// src/components/CoachHeroCard.tsx
import React from 'react';

type SummaryTone = 'danger' | 'warn' | 'ok' | 'unknown';

type CoachHeroCardProps = {
  teamName: string;
  summaryTone: SummaryTone;
  summaryMessage: string;
  summaryLabel: string;
  roster: number;
  averageACWR: string | number | null;
  validCount: number;
  riskHigh: number;
  riskCaution: number;
  loading?: boolean;
};

export function CoachHeroCard({
  teamName,
  summaryTone,
  summaryMessage,
  summaryLabel,
  roster,
  averageACWR,
  validCount,
  riskHigh,
  riskCaution,
  loading,
}: CoachHeroCardProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-2xl shadow-lg p-5 sm:p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{teamName}</h2>
          <p className="text-blue-100 text-sm mt-0.5">
            {loading ? '読込中...' : summaryMessage}
          </p>
        </div>
        {!loading && averageACWR != null && (
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
            summaryTone === 'danger' ? 'bg-red-500/90' :
            summaryTone === 'warn' ? 'bg-amber-500/90 text-gray-900' :
            summaryTone === 'ok' ? 'bg-emerald-500/90' :
            'bg-white/20'
          }`}>
            {summaryLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{roster}</div>
          <div className="text-xs text-blue-100 mt-0.5">選手数</div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{averageACWR ?? '—'}</div>
          <div className="text-xs text-blue-100 mt-0.5">チームACWR</div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{validCount}</div>
          <div className="text-xs text-blue-100 mt-0.5">データ有効</div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">
            {riskHigh > 0 ? riskHigh : riskCaution > 0 ? riskCaution : 0}
          </div>
          <div className="text-xs text-blue-100 mt-0.5">
            {riskHigh > 0 ? '要注意' : riskCaution > 0 ? '注意' : '問題なし'}
          </div>
        </div>
      </div>
    </div>
  );
}
