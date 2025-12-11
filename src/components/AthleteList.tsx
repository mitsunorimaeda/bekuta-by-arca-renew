import React, { useState, useMemo } from 'react';
import { User } from '../lib/supabase';
import { Activity, AlertTriangle, ChevronRight } from 'lucide-react';

// ACWR 情報の型（マップの中身）
type RiskLevel = 'high' | 'caution' | 'good' | 'low';

interface AthleteACWRInfo {
  currentACWR: number | null;
  riskLevel?: RiskLevel;
  daysOfData?: number | null;
}

// StaffAthleteWithActivity 相当の拡張（あってもなくても動くようにオプショナル）
type AthleteWithActivity = User & {
  training_days_28d?: number | null;
  training_sessions_28d?: number | null;
  last_training_date?: string | null;
};

interface AthleteListProps {
  athletes: AthleteWithActivity[];
  onAthleteSelect: (athlete: AthleteWithActivity) => void;
  athleteACWRMap?: Record<string, AthleteACWRInfo>;
}

// ACWR 分析を始めるまでに必要な日数
const MIN_DAYS_FOR_ACWR = 21;

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

      // daysOfData は acwrInfo があればそれを優先、なければ training_days_28d を代用
      const daysOfData =
        acwrInfo?.daysOfData ??
        (typeof athlete.training_days_28d === 'number'
          ? athlete.training_days_28d
          : null);

      const hasACWR =
        acwrInfo &&
        daysOfData !== null &&
        daysOfData >= MIN_DAYS_FOR_ACWR &&
        typeof acwrInfo.currentACWR === 'number' &&
        acwrInfo.currentACWR > 0;

      const riskLevel = hasACWR ? acwrInfo?.riskLevel : undefined;

      const riskMatch =
        filterRisk === 'all'
          ? true
          : riskLevel === 'high' || riskLevel === 'caution';

      const s = search.trim().toLowerCase();
      const text =
        (athlete.name || '') +
        ' ' +
        (athlete.email || '') +
        ' ' +
        (athlete.nickname || '');

      const searchMatch =
        s === '' ? true : text.toLowerCase().includes(s);

      return riskMatch && searchMatch;
    });
  }, [athletes, search, filterRisk, athleteACWRMap]);

  const renderRiskBadge = (riskLevel: RiskLevel | undefined) => {
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

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '記録なし';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* 検索 ＋ リスクフィルタ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・ニックネーム・メールで検索"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <Activity className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filterRisk === 'all'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            全員表示
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('high')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${
              filterRisk === 'high'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            高リスクのみ
          </button>
        </div>
      </div>

      {/* リスト本体 */}
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white">
        {filteredAthletes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            条件に合う選手がいません
          </div>
        ) : (
          filteredAthletes.map((athlete) => {
            const acwrInfo = athleteACWRMap[athlete.id];

            // daysOfData 決定ロジック
            const daysOfData =
              acwrInfo?.daysOfData ??
              (typeof athlete.training_days_28d === 'number'
                ? athlete.training_days_28d
                : null);

            const hasACWR =
              acwrInfo &&
              daysOfData !== null &&
              daysOfData >= MIN_DAYS_FOR_ACWR &&
              typeof acwrInfo.currentACWR === 'number' &&
              acwrInfo.currentACWR > 0;

            const acwrValue = hasACWR
              ? acwrInfo!.currentACWR!.toFixed(2)
              : '準備中';

            const riskLevel: RiskLevel | undefined = hasACWR
              ? acwrInfo?.riskLevel
              : undefined;

            const remainingDays =
              daysOfData !== null
                ? Math.max(MIN_DAYS_FOR_ACWR - daysOfData, 0)
                : null;

            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => onAthleteSelect(athlete)}
                className="w-full flex items-stretch justify-between px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 transition-colors text-left"
              >
                {/* 左側：基本情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {athlete.nickname || athlete.name || '名前未設定'}
                    </p>
                    {athlete.nickname && athlete.name && (
                      <p className="text-xs text-gray-400 truncate">
                        ({athlete.name})
                      </p>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {athlete.email}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-gray-500">
                    <span>
                      直近28日：{' '}
                      {athlete.training_days_28d ?? 0}日 /{' '}
                      {athlete.training_sessions_28d ?? 0}回
                    </span>
                    <span>
                      最終入力：{' '}
                      {formatDate(athlete.last_training_date ?? null)}
                    </span>
                  </div>
                </div>

                {/* 右側：ACWR & リスク */}
                <div className="flex flex-col items-end justify-center ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] sm:text-xs text-gray-500">
                      ACWR
                    </span>
                    <span
                      className={`text-sm sm:text-base font-semibold ${
                        hasACWR
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {acwrValue}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderRiskBadge(riskLevel)}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* 21日未満のときだけ「あと◯日」を表示 */}
                  {!hasACWR &&
                    remainingDays !== null &&
                    remainingDays > 0 && (
                      <p className="mt-1 text-[10px] sm:text-xs text-gray-400 text-right">
                        ACWR分析まで：あと {remainingDays} 日
                      </p>
                    )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}