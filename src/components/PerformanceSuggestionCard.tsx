// src/components/PerformanceSuggestionCard.tsx
import React from 'react';
import { Lightbulb, Target, Info } from 'lucide-react';

type Props = {
  title: string;
  summary: string;
  basisLabel: string; // 例: "チーム" or "組織（n少のため拡大）"
  basisN: number | null;
  bullets: string[];
};

export function PerformanceSuggestionCard({ title, summary, basisLabel, basisN, bullets }: Props) {
  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-emerald-700" />
            <div className="font-semibold text-emerald-900">{title}</div>
          </div>

          <div className="mt-1 text-sm text-emerald-900">{summary}</div>

          <ul className="mt-3 space-y-1 text-sm text-emerald-900">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <Target className="w-4 h-4 mt-0.5 text-emerald-700" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 text-xs text-emerald-800 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>
              比較母集団：{basisLabel}
              {typeof basisN === 'number' ? `（n=${basisN}）` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}