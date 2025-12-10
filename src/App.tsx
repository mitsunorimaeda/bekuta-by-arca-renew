import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Activity,
  Search,
  Filter,
  ArrowUpDown,
  Circle
} from 'lucide-react';

type AthleteListProps = {
  athletes: any[];
  onAthleteSelect: (athlete: any) => void;
};

// ACWR からリスク判定（バックエンドに risk_level があればそれを優先）
function getRiskInfo(athlete: any) {
  const explicitLevel: string | null =
    athlete.latest_risk_level ||
    athlete.risk_level ||
    null;

  let acwr: number | null = null;

  if (typeof athlete.latest_acwr === 'number') {
    acwr = athlete.latest_acwr;
  } else if (typeof athlete.acwr === 'number') {
    acwr = athlete.acwr;
  } else if (typeof athlete.latestACWR === 'number') {
    acwr = athlete.latestACWR;
  }

  const deriveFromACWR = (value: number | null): string => {
    if (value == null) return 'unknown';
    if (value >= 1.5) return 'high';
    if (value >= 1.2) return 'caution';
    if (value >= 0.8) return 'good';
    return 'low';
  };

  const level = explicitLevel || deriveFromACWR(acwr);
  const riskWeight =
    level === 'high'
      ? 3
      : level === 'caution'
      ? 2
      : level === 'good'
      ? 1
      : level === 'low'
      ? 0
      : -1;

  const label =
    level === 'high'
      ? '高リスク'
      : level === 'caution'
      ? '要注意'
      : level === 'good'
      ? '良好'
      : level === 'low'
      ? '低負荷'
      : '不明';

  const badgeClass =
    level === 'high'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : level === 'caution'
      ? 'bg-orange-50 text-orange-700 border border-orange-200'
      : level === 'good'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : level === 'low'
      ? 'bg-blue-50 text-blue-700 border border-blue-200'
      : 'bg-gray-50 text-gray-600 border border-gray-200';

  const dotClass =
    level === 'high'
      ? 'text-red-500'
      : level === 'caution'
      ? 'text-orange-500'
      : level === 'good'
      ? 'text-emerald-500'
      : level === 'low'
      ? 'text-blue-500'
      : 'text-gray-400';

  return {
    acwr,
    level,
    label,
    riskWeight,
    badgeClass,
    dotClass
  };
}

// 28日間の練習日数っぽいものを拾う（カラム名は色々に対応）
function getActivityInfo(athlete: any) {
  const days =
    athlete.training_days_28d ??
    athlete.training_days_last_28 ??
    athlete.trainingDays28d ??
    athlete.trainingDays ??
    0;

  const sessions =
    athlete.training_sessions_28d ??
    athlete.training_sessions_last_28 ??
    athlete.trainingSessions28d ??
    athlete.trainingSessions ??
    days ?? 0;

  const lastDate =
    athlete.last_training_date ||
    athlete.lastTrainingDate ||
    athlete.latest_training_date ||
    null;

  return { days, sessions, lastDate };
}

export function AthleteList({ athletes, onAthleteSelect }: AthleteListProps) {
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'caution' | 'no-data'>('all');
  const [sortKey, setSortKey] = useState<'risk' | 'name' | 'acwr' | 'activity'>('risk');

  const enhancedAthletes = useMemo(() => {
    return athletes.map((athlete) => {
      const risk = getRiskInfo(athlete);
      const activity = getActivityInfo(athlete);

      return {
        ...athlete,
        _metrics: {
          risk,
          activity
        }
      };
    });
  }, [athletes]);

  const filteredAndSorted = useMemo(() => {
    let list = [...enhancedAthletes];

    // 検索（名前・メール）
    if (query.trim() !== '') {
      const q = query.trim().toLowerCase();
      list = list.filter((a) => {
        const name = (a.name || '').toLowerCase();
        const email = (a.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    // リスクフィルタ
    if (riskFilter === 'high') {
      list = list.filter((a) => a._metrics.risk.level === 'high');
    } else if (riskFilter === 'caution') {
      list = list.filter((a) => a._metrics.risk.level === 'caution');
    } else if (riskFilter === 'no-data') {
      list = list.filter(
        (a) =>
          a._metrics.risk.level === 'unknown' &&
          (a._metrics.risk.acwr == null || Number.isNaN(a._metrics.risk.acwr))
      );
    }

    // ソート
    list.sort((a, b) => {
      const ma = a._metrics;
      const mb = b._metrics;

      if (sortKey === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }

      if (sortKey === 'acwr') {
        const va = ma.risk.acwr ?? -1;
        const vb = mb.risk.acwr ?? -1;
        return vb - va; // 高い順
      }

      if (sortKey === 'activity') {
        const va = ma.activity.days ?? 0;
        const vb = mb.activity.days ?? 0;
        return vb - va; // 多い順
      }

      // sortKey === 'risk'
      const va = ma.risk.riskWeight;
      const vb = mb.risk.riskWeight;
      return vb - va;
    });

    return list;
  }, [enhancedAthletes, query, riskFilter, sortKey]);

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 検索 */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="選手名やメールアドレスで検索"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>

        {/* フィルタ & ソート */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
            <Filter className="w-3 h-3 text-gray-400" />
            <button
              className={`px-2 py-1 text-xs rounded-full ${
                riskFilter === 'all'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              onClick={() => setRiskFilter('all')}
            >
              すべて
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-full ${
                riskFilter === 'high'
                  ? 'bg-red-100 text-red-700'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              onClick={() => setRiskFilter('high')}
            >
              高リスク
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-full ${
                riskFilter === 'caution'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              onClick={() => setRiskFilter('caution')}
            >
              要注意
            </button>
            <button
              className={`px-2 py-1 text-xs rounded-full ${
                riskFilter === 'no-data'
                  ? 'bg-gray-200 text-gray-700'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              onClick={() => setRiskFilter('no-data')}
            >
              データ未入力
            </button>
          </div>

          {/* モバイル向けフィルタ簡略版 */}
          <div className="sm:hidden">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">全員</option>
              <option value="high">高リスク</option>
              <option value="caution">要注意</option>
              <option value="no-data">データ未入力</option>
            </select>
          </div>

          {/* ソート */}
          <div>
            <div className="inline-flex items-center border border-gray-300 rounded-lg px-2 py-1 bg-white">
              <ArrowUpDown className="w-3 h-3 text-gray-400 mr-1" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="text-xs bg-transparent border-none focus:outline-none focus:ring-0"
              >
                <option value="risk">リスク順</option>
                <option value="acwr">ACWR順</option>
                <option value="activity">練習日数順</option>
                <option value="name">名前順</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* リスト本体 */}
      <div className="space-y-3">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-300 rounded-xl">
            条件に合致する選手がいません。フィルタや検索条件を見直してください。
          </div>
        ) : (
          filteredAndSorted.map((athlete) => {
            const { risk, activity } = athlete._metrics;
            const hasACWR = risk.acwr != null && !Number.isNaN(risk.acwr);

            return (
              <button
                key={athlete.id}
                onClick={() => onAthleteSelect(athlete)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-green-300 hover:shadow-md transition-all px-4 py-3 sm:px-5 sm:py-4"
              >
                {/* 上段：名前・メール・詳細ボタン */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                      {athlete.name || '名前未設定'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {athlete.email || 'メール未設定'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {risk.level === 'high' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-xs text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        高リスク
                      </span>
                    )}
                    {risk.level === 'caution' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-xs text-orange-700 border border-orange-200">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        要注意
                      </span>
                    )}
                    <span className="inline-flex items-center text-xs text-blue-600 font-medium">
                      詳細
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>

                {/* 中段：ACWR & リスク */}
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50">
                        <Activity className="w-4 h-4 text-blue-500" />
                      </span>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                          ACWR
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {hasACWR ? risk.acwr.toFixed(2) : '-'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">リスク評価</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${risk.badgeClass}`}
                      >
                        <Circle className={`w-2 h-2 mr-1.5 ${risk.dotClass}`} />
                        {risk.label}
                      </span>
                    </div>
                  </div>

                  {/* モバイルでは下段に回るので PC時だけ表示 */}
                  <div className="hidden sm:flex flex-col items-end text-xs">
                    <p className="text-gray-500 mb-1">直近28日間の練習</p>
                    <p className="text-gray-900 font-semibold">
                      {activity.days ?? 0} 日
                      <span className="text-gray-400 text-[11px] ml-1">
                        / 28日
                      </span>
                    </p>
                    {activity.lastDate && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        最終記録：
                        {new Date(activity.lastDate).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                </div>

                {/* 下段：モバイル用の練習情報 */}
                <div className="mt-3 sm:hidden border-t border-gray-100 pt-2 flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-gray-400" />
                    <span>
                      28日間の練習日数：
                      <span className="font-semibold text-gray-900">
                        {activity.days ?? 0}日
                      </span>
                    </span>
                  </div>
                  {activity.lastDate && (
                    <span className="text-[11px] text-gray-400">
                      最終：
                      {new Date(activity.lastDate).toLocaleDateString('ja-JP')}
                    </span>
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