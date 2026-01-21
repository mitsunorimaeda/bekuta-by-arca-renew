// src/components/AthleteList.tsx
import React, { useState, useMemo } from 'react';
import { User } from '../lib/supabase';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';

// ACWR 情報の型（マップの中身）
type RiskLevel = 'high' | 'caution' | 'good' | 'low' | 'unknown';

interface AthleteACWRInfo {
  // ✅ athlete_acwr_daily の最新日の値を入れる想定
  currentACWR: number | null;
  acute7d?: number | null;       // ✅ athlete_acwr_daily.acute_7d
  chronicLoad?: number | null;   // ✅ athlete_acwr_daily.chronic_load（28d/4）
  dailyLoad?: number | null;     // ✅ athlete_acwr_daily.daily_load（当日）
  lastDate?: string | null;      // ✅ athlete_acwr_daily.date（YYYY-MM-DD）
  riskLevel?: RiskLevel;
  daysOfData?: number | null;    // ✅ athlete_acwr_daily.days_of_data
}

// StaffAthleteWithActivity 相当の拡張（あってもなくても動くようにオプショナル）
type AthleteWithActivity = User & {
  training_days_28d?: number | null;
  training_sessions_28d?: number | null;
  last_training_date?: string | null;
};

type CoachWeekAthleteCard = {
  athlete_user_id: string;

  week_duration_min: number;
  week_rpe_avg: number | null;
  week_load_sum: number;

  sleep_hours_avg: number | null;
  sleep_quality_avg: number | null;

  motivation_avg: number | null;
  energy_avg: number | null;
  stress_avg: number | null;

  // 共有（選手主導）
  is_sharing_active: boolean;
  allow_condition: boolean;
  allow_training: boolean;
  allow_body: boolean;
  allow_reflection: boolean;
  allow_free_note: boolean;

  // 行動目標
  action_total: number;
  action_done: number;
  action_done_rate: number; // 0-100
};

interface AthleteListProps {
  athletes: AthleteWithActivity[];
  onAthleteSelect: (athlete: AthleteWithActivity) => void;
  athleteACWRMap?: Record<string, AthleteACWRInfo>;

  // 週次カード（今週）: athlete_user_id -> card
  weekCardMap?: Record<string, CoachWeekAthleteCard>;
}

// ACWR 分析を始めるまでに必要な日数
const MIN_DAYS_FOR_ACWR = 21;

export function AthleteList({
  athletes,
  onAthleteSelect,
  athleteACWRMap = {},
  weekCardMap = {},
}: AthleteListProps) {
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');
  const [filterSharing, setFilterSharing] = useState<'all' | 'on'>('all');
  const displayName = (a: any) => a?.nickname || a?.name || '名前未設定';

  const filteredAthletes = useMemo(() => {
    const s = search.trim().toLowerCase();

    return athletes.filter((athlete) => {
      const acwrInfo = athleteACWRMap[athlete.id];

      // ✅ days は DB（athlete_acwr_daily.days_of_data）だけを見る
      const daysOfData =
        typeof acwrInfo?.daysOfData === 'number' && Number.isFinite(acwrInfo.daysOfData)
          ? acwrInfo.daysOfData
          : null;

      const acwrNum =
        typeof acwrInfo?.currentACWR === 'number' && Number.isFinite(acwrInfo.currentACWR)
          ? acwrInfo.currentACWR
          : null;

      // ✅ hasACWR：ACWRが数値で入っていて、日数も満たしている（ただし days がnullなら ACWR優先で表示はする）
      const hasACWR =
        acwrNum != null &&
        acwrNum > 0 &&
        (daysOfData == null ? true : daysOfData >= MIN_DAYS_FOR_ACWR);

      const riskLevel: RiskLevel = hasACWR ? (acwrInfo?.riskLevel ?? 'unknown') : 'unknown';

      // ✅ 「高リスクのみ」は high のみ（caution を混ぜない）
      const riskMatch = filterRisk === 'all' ? true : riskLevel === 'high';

      const card = weekCardMap[athlete.id];
      const sharingMatch = filterSharing === 'all' ? true : !!card?.is_sharing_active;

      const text = `${displayName(athlete)}`.toLowerCase();
      const searchMatch = s === '' ? true : text.includes(s);

      return riskMatch && sharingMatch && searchMatch;
    });
  }, [athletes, search, filterRisk, filterSharing, athleteACWRMap, weekCardMap]);

  const renderRiskBadge = (riskLevel: RiskLevel) => {
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

  // ✅ YYYY-MM-DD は Date() に通さずそのまま表示（タイムゾーンでズレるのを防ぐ）
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '記録なし';

    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (Number.isFinite(mm) && Number.isFinite(dd)) return `${mm}/${dd}`;
      return dateStr;
    }

    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  const fmt1 = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '-';
    if (Number.isNaN(v)) return '-';
    return v.toFixed(1);
  };

  const fmt0 = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '-';
    if (Number.isNaN(v)) return '-';
    return String(Math.round(v));
  };

  const renderSharingBadge = (card?: CoachWeekAthleteCard) => {
    const on = !!card?.is_sharing_active;
    return on ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Unlock className="w-3 h-3" />
        共有ON
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
        <Lock className="w-3 h-3" />
        共有OFF
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 検索 ＋ フィルタ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前で検索"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <Activity className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => setFilterSharing(filterSharing === 'on' ? 'all' : 'on')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${
              filterSharing === 'on'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
            title="共有ONの選手だけ表示"
          >
            <Unlock className="w-3 h-3" />
            共有ONのみ
          </button>
        </div>
      </div>

      {/* リスト本体 */}
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white">
        {filteredAthletes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">条件に合う選手がいません</div>
        ) : (
          filteredAthletes.map((athlete) => {
            const key =
              (athlete as any)?.id ??
              (athlete as any)?.user_id ??
              (athlete as any)?.athlete_user_id;

            const acwrInfo = key ? (athleteACWRMap as any)[key] : undefined;

            // ✅ days
            const daysOfData =
              typeof acwrInfo?.daysOfData === 'number' && Number.isFinite(acwrInfo.daysOfData)
                ? acwrInfo.daysOfData
                : null;

            // ✅ ACWR “値があるか” と “準備完了か” を分離
            const acwrNum =
              typeof acwrInfo?.currentACWR === 'number' && Number.isFinite(acwrInfo.currentACWR)
                ? acwrInfo.currentACWR
                : null;

            // 値があるか（0も表示したいので >=0 判定にする）
            const hasValue = acwrNum != null;

            // 準備完了（リスク判定に使う）
            const isReady =
              acwrNum != null &&
              acwrNum > 0 &&
              (daysOfData == null ? true : daysOfData >= MIN_DAYS_FOR_ACWR);

            // ✅ “表示” は hasValue ベースにする（ここが今回の修正の核心）
            const acwrValue = hasValue ? acwrNum!.toFixed(2) : '-';

            // ✅ リスクは “準備完了してる時だけ” 出す
            const riskLevel: RiskLevel = isReady ? (acwrInfo?.riskLevel ?? 'unknown') : 'unknown';

            // ✅ 日付キーも吸収（lastDate / latestDate どっちでも）
            const lastDate = acwrInfo?.lastDate ?? (acwrInfo as any)?.latestDate ?? null;

            const remainingDays =
              daysOfData !== null ? Math.max(MIN_DAYS_FOR_ACWR - daysOfData, 0) : null;



            // ✅ 直近7日 Load は DBの acute_7d を表示（当日含む7日）
            const acute7d =
              typeof acwrInfo?.acute7d === 'number' && Number.isFinite(acwrInfo.acute7d)
                ? acwrInfo.acute7d
                : null;

            const card = weekCardMap[athlete.id];
            const shareOn = !!card?.is_sharing_active;

            const disabled = !shareOn;

            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onAthleteSelect(athlete);
                }}
                disabled={disabled}
                className={`w-full flex items-stretch justify-between px-4 sm:px-5 py-3 sm:py-4 text-left transition-colors ${
                  disabled ? 'opacity-60 cursor-not-allowed bg-white' : 'hover:bg-gray-50'
                }`}
                title={disabled ? 'この選手は現在、共有がOFFです（🔒）' : '詳細を開く'}
              >
                {/* 左側：基本情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {displayName(athlete)}
                    </p>
                    {(athlete as any).nickname && athlete.name && (
                      <p className="text-xs text-gray-400 truncate">({athlete.name})</p>
                    )}

                    {renderSharingBadge(card)}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-gray-500">
                    {/* ここは “活動量の目安” として残してOK */}
                    <span>
                      直近28日： {athlete.training_days_28d ?? 0}日 / {athlete.training_sessions_28d ?? 0}回
                    </span>
                    <span>最終入力： {formatDate(athlete.last_training_date ?? null)}</span>
                  </div>

                  {/* ✅ 直近7日Load（DBのacute_7d） */}
                  {shareOn && (
                    <div className="mt-2 text-[11px] sm:text-xs text-gray-600">
                      直近7日Load： <b>{acute7d != null ? Math.round(acute7d) : '-'}</b>

                      {(() => {
                        const lastDate = acwrInfo?.lastDate ?? (acwrInfo as any)?.latestDate ?? null;
                        return lastDate ? (
                          <span className="ml-2 text-gray-400">（{formatDate(lastDate)}時点）</span>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* 今週サマリー（共有ONの時だけ） */}
                  {shareOn && card && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                      {card.action_total > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <CheckCircle2 className="w-3 h-3" />
                          行動 {card.action_done}/{card.action_total}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                          行動 -
                        </span>
                      )}

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        睡眠 {fmt1(card.sleep_hours_avg)}h / 質 {fmt1(card.sleep_quality_avg)}
                      </span>

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        モチ {fmt0(card.motivation_avg)}・エネ {fmt0(card.energy_avg)}・スト {fmt0(card.stress_avg)}
                      </span>
                    </div>
                  )}

                  {!shareOn && (
                    <div className="mt-2 text-[11px] sm:text-xs text-gray-500">
                      🔒 共有がOFFのため、詳細データは表示できません
                    </div>
                  )}
                </div>

                {/* 右側：ACWR & リスク */}
                <div className="flex flex-col items-end justify-center ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] sm:text-xs text-gray-500">ACWR</span>
                    <span
                      className={`text-sm sm:text-base font-semibold ${
                        isReady ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {acwrValue}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderRiskBadge(riskLevel)}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* 21日未満のときだけ「進捗/残日数」を表示 */}
                  {!hasACWR && (
                    <p className="mt-1 text-[10px] sm:text-xs text-gray-400 text-right">
                      ACWR準備：{daysOfData ?? 0}/{MIN_DAYS_FOR_ACWR}日
                      {remainingDays !== null && remainingDays > 0 ? `（あと${remainingDays}日）` : ''}
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