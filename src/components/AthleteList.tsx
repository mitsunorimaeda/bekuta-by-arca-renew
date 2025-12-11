import React, { useState, useMemo } from 'react';
import { User } from '../lib/supabase';

type RiskLevel = 'high' | 'caution' | 'good' | 'low' | 'unknown';

type AthleteACWRInfo = {
  currentACWR?: number | null;
  riskLevel?: RiskLevel | string;
  hasEnoughData?: boolean;   // 28日分そろっているかどうか（なければ undefined でOK）
  daysOfData?: number;       // ある場合だけ使う
  minDaysRequired?: number;  // ある場合だけ使う（例：28）
};

interface AthleteListProps {
  athletes: (User & {
    training_days_28d?: number | null;
    training_sessions_28d?: number | null;
    last_training_date?: string | null;
  })[];
  onAthleteSelect: (athlete: User) => void;
  athleteACWRMap?: Record<string, AthleteACWRInfo>;
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

  const getRiskColorClass = (riskLevel: string | undefined) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600';
      case 'caution':
        return 'text-amber-600';
      case 'good':
        return 'text-emerald-600';
      case 'low':
        return 'text-sky-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* 検索 & フィルタ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="選手名やメールアドレスで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <button
          onClick={() =>
            setFilterRisk((prev) => (prev === 'all' ? 'high' : 'all'))
          }
          className={`inline-flex items-center px-3 py-2 rounded-lg text-xs sm:text-sm border ${
            filterRisk === 'high'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
        >
          {filterRisk === 'high' ? '高リスクのみ表示中' : 'リスク高を絞り込み'}
        </button>
      </div>

      {/* 一覧 */}
      <div className="space-y-3">
        {filteredAthletes.map((athlete) => {
          const acwrInfo = athleteACWRMap[athlete.id];
          const hasACWR =
            acwrInfo &&
            acwrInfo.hasEnoughData !== false &&
            typeof acwrInfo.currentACWR === 'number' &&
            acwrInfo.currentACWR > 0;

          const acwrDisplay = hasACWR
            ? acwrInfo!.currentACWR!.toFixed(2)
            : '準備中';

          const riskLevel = hasACWR ? acwrInfo?.riskLevel : undefined;
          const acwrTextColor = getRiskColorClass(riskLevel);

          const daysOfData = acwrInfo?.daysOfData;
          const minDaysRequired = acwrInfo?.minDaysRequired ?? 28;

          return (
            <button
              key={athlete.id}
              onClick={() => onAthleteSelect(athlete)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl px-3 py-3 sm:px-4 sm:py-4 hover:shadow-sm transition flex items-center justify-between"
            >
              {/* 左側：基本情報 */}
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm sm:text-base text-gray-900 truncate">
                    {athlete.nickname || athlete.name || '名前未設定'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {athlete.email}
                </p>

                {/* 練習状況（あれば） */}
                <p className="mt-2 text-xs text-gray-500">
                  直近28日間の練習日数:{' '}
                  <span className="font-medium text-gray-700">
                    {athlete.training_days_28d ?? 'ー'}日
                  </span>
                </p>
              </div>

              {/* 右側：ACWR & リスク */}
              <div className="text-right flex flex-col items-end space-y-1">
                <div className="text-[11px] sm:text-xs text-gray-500">
                  ACWR
                </div>
                <div
                  className={`text-lg sm:text-xl font-semibold ${acwrTextColor}`}
                >
                  {acwrDisplay}
                </div>

                {hasACWR ? (
                  renderRiskBadge(riskLevel as string | undefined)
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    分析準備中
                  </span>
                )}

                {!hasACWR && daysOfData != null && (
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-400">
                    データ{daysOfData}日目 / {minDaysRequired}日で解析開始
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {filteredAthletes.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">
            条件に一致する選手がいません。
          </p>
        )}
      </div>
    </div>
  );
}