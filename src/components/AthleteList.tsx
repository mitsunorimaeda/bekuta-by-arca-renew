// src/components/AthleteList.tsx
import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { User } from '../lib/supabase';
import { AthleteACWRMap } from '../hooks/useTeamACWR';

type AthleteWithActivity = User & {
  training_days_28d?: number | null;
  training_sessions_28d?: number | null;
  last_training_date?: string | null;
};

interface AthleteListProps {
  athletes: AthleteWithActivity[];
  onAthleteSelect: (athlete: AthleteWithActivity) => void;
  athleteACWRMap?: AthleteACWRMap;
}

export function AthleteList({
  athletes,
  onAthleteSelect,
  athleteACWRMap = {},
}: AthleteListProps) {
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');

  const filteredAthletes = useMemo(() => {
    return athletes.filter((athlete) => {
      const acwrInfo = athleteACWRMap[athlete.id];

      const riskMatch =
        filterRisk === 'all'
          ? true
          : acwrInfo?.riskLevel === 'high' || acwrInfo?.riskLevel === 'caution';

      const s = search.trim().toLowerCase();
      const text =
        (athlete.name || '') +
        ' ' +
        (athlete.email || '') +
        ' ' +
        (athlete.nickname || '');

      const searchMatch = s === '' ? true : text.toLowerCase().includes(s);

      return riskMatch && searchMatch;
    });
  }, [athletes, search, filterRisk, athleteACWRMap]);

  const renderRiskBadge = (riskLevel: string | undefined) => {
    switch (riskLevel) {
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            高リスク
          </span>
        );
      case 'caution':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            注意
          </span>
        );
      case 'good':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            良好
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
            低負荷
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            不明
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 検索 & フィルター */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="選手名やメールアドレスで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex-shrink-0 flex gap-2">
          <button
            type="button"
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              filterRisk === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            全員
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('high')}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              filterRisk === 'high'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-red-600 border-red-300'
            }`}
          >
            リスク高
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="space-y-3">
        {filteredAthletes.map((athlete) => {
          const acwrInfo = athleteACWRMap[athlete.id];
          const latestACWR =
            acwrInfo?.latestACWR != null && acwrInfo.latestACWR > 0
              ? acwrInfo.latestACWR.toFixed(2)
              : '-';

          return (
            <button
              key={athlete.id}
              onClick={() => onAthleteSelect(athlete)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-400 hover:shadow-sm transition flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {athlete.name || athlete.nickname || '無名の選手'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {athlete.email}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">
                    詳細 &gt;
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">ACWR</span>
                    <span className="font-semibold text-gray-900">
                      {latestACWR}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">リスク評価</span>
                    {renderRiskBadge(acwrInfo?.riskLevel)}
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  28日間の練習日数:{' '}
                  {athlete.training_days_28d != null
                    ? `${athlete.training_days_28d}日`
                    : 'データなし'}
                </div>
              </div>
            </button>
          );
        })}

        {filteredAthletes.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8">
            条件に一致する選手がいません。
          </div>
        )}
      </div>
    </div>
  );
}