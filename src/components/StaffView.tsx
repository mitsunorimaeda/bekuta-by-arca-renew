// src/components/StaffView.tsx
import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { Alert } from '../lib/alerts';

import { AthleteList } from './AthleteList';
import { AthleteDetailModal } from './AthleteDetailModal';
import { TeamACWRChart } from './TeamACWRChart';
import { AlertPanel } from './AlertPanel';
import { TutorialController } from './TutorialController';
import { ChartErrorBoundary } from './ChartErrorBoundary';

import { useTeamACWR } from '../hooks/useTeamACWR';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { useOrganizations } from '../hooks/useOrganizations';
import { calcRiskForAthlete, sortAthletesByRisk, AthleteRisk } from '../lib/riskUtils';

import { useWeeklyGrowthCycle } from '../hooks/useWeeklyGrowthCycle';
import { WeeklyGrowthCycleView } from './WeeklyGrowthCycleView';

import { GrowthUnderstandingQuadrantSummary } from './GrowthUnderstandingQuadrantSummary';
import { useDailyGrowthMatrix } from '../hooks/useDailyGrowthMatrix';
import { GrowthUnderstandingMatrix } from './GrowthUnderstandingMatrix';

import {
  Users,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Activity,
  HelpCircle,
  UserCog,
  UsersRound,
  MessageSquare,
  FileText,
  PieChart,
  Lock,
} from 'lucide-react';

// import { TeamInjuryRiskHeatmap } from './TeamInjuryRiskHeatmap';
// import { TeamPerformanceComparison } from './TeamPerformanceComparison';
// import { TeamTrendAnalysis } from './TeamTrendAnalysis';

const TeamExportPanel = lazy(() =>
  import('./TeamExportPanel').then((m) => ({ default: m.TeamExportPanel }))
);
const ReportView = lazy(() =>
  import('./ReportView').then((m) => ({ default: m.ReportView }))
);
// const TeamAccessRequestManagement = lazy(() =>
//   import('./TeamAccessRequestManagement').then((m) => ({
//     default: m.TeamAccessRequestManagement,
//   }))
// );
// const AthleteTransferManagement = lazy(() =>
//   import('./AthleteTransferManagement').then((m) => ({
//     default: m.AthleteTransferManagement,
//   }))
// );
// const MessagingPanel = lazy(() =>
//   import('./MessagingPanel').then((m) => ({ default: m.MessagingPanel }))
// );

interface StaffViewProps {
  user: User;
  alerts: Alert[];
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

// 既存の activity view 取得用（維持）
type StaffAthleteWithActivity = User & {
  training_days_28d: number | null;
  training_sessions_28d: number | null;
  last_training_date: string | null;
};

type CoachWeekAthleteCard = {
  team_id: string;
  athlete_user_id: string;
  athlete_name: string;

  week_duration_min: number;
  week_rpe_avg: number | null;
  week_load_sum: number;

  sleep_hours_avg: number | null;
  sleep_quality_avg: number | null;

  motivation_avg: number | null;
  energy_avg: number | null;
  stress_avg: number | null;

  wellness_shared: boolean;

  action_total: number;
  action_done: number;
  action_done_rate: number;

  is_sharing_active: boolean;
  allow_condition: boolean;
  allow_training: boolean;
  allow_body: boolean;
  allow_reflection: boolean;
  allow_free_note: boolean;
};

type TeamCauseTagRow = {
  team_id: string;
  tag: string;
  cnt: number;
};

const NO_DATA_DAYS_THRESHOLD = 14;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

// ✅ JSTの "YYYY-MM-DD" 取得
const getJSTDateKey = (d: Date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // "YYYY-MM-DD"
};

const getThisWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const diffToMon = (day + 6) % 7; // Mon=0

  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon);
  mon.setHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  return { start: toISODate(mon), end: toISODate(sun) };
};

// -------------------------
// ACWR helpers（表示用）
// -------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;

type RiskLevel = 'high' | 'caution' | 'good' | 'low';

const calcRisk = (acwr: number): RiskLevel => {
  if (acwr >= 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';
};

type SummaryTone = 'danger' | 'warn' | 'ok' | 'unknown';

const getSummaryTone = (avg: number | null, valid: number, roster: number): SummaryTone => {
  // データ不足は Unknown
  const minValid = Math.min(5, Math.max(1, Math.floor(roster * 0.2))); // 少人数でも破綻しない
  if (avg == null || valid < minValid) return 'unknown';
  if (avg >= 1.5) return 'danger';
  if (avg >= 1.3) return 'warn';
  return 'ok';
};

const getSummaryLabel = (tone: SummaryTone) => {
  if (tone === 'danger') return 'High';
  if (tone === 'warn') return 'Caution';
  if (tone === 'ok') return 'Good';
  return 'Unknown';
};

const getSummaryMessage = (tone: SummaryTone, valid: number, roster: number) => {
  if (tone === 'unknown') return `データ不足：有効人数が少ない（${valid}/${roster}）`;
  if (tone === 'danger') return '注意：負荷が高い可能性。声かけ・練習後RPE確認推奨';
  if (tone === 'warn') return '注意：やや高め。回復状況の確認推奨';
  return '安定：通常運用でOK';
};

const toneStyles: Record<SummaryTone, { box: string; badge: string; dot: string }> = {
  danger: {
    box: 'border-red-200 bg-red-50',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  warn: {
    box: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  ok: {
    box: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  unknown: {
    box: 'border-gray-200 bg-gray-50',
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
};

type AthleteACWRInfo = {
  currentACWR: number | null;
  riskLevel?: RiskLevel;
  daysOfData?: number | null;
};

// ✅ DB（athlete_acwr_daily）から取る形（列が無ければnullでもOK）
type AthleteACWRDailyRow = {
  user_id: string;
  date: string; // YYYY-MM-DD
  acwr: number | null;
  days_of_data?: number | null;
  risk_level?: RiskLevel | null;
};

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

export function StaffView({
  user,
  alerts,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
  onNavigateToHelp,
}: StaffViewProps) {
  // =========================
  // State
  // =========================
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [athletes, setAthletes] = useState<StaffAthleteWithActivity[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(false);
  const [athletesError, setAthletesError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // ✅ AthleteList に渡すのは「数値Map」
  const [athleteACWRMap, setAthleteACWRMap] = useState<Record<string, AthleteACWRInfo>>({});
  const [acwrLoading, setAcwrLoading] = useState(false);

  // 週次サマリー（RPC）
  const [weekRange, setWeekRange] = useState(() => getThisWeekRange());
  const [weekCards, setWeekCards] = useState<CoachWeekAthleteCard[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  // ✅ 原因タグ（週次）
  const [teamCauseTags, setTeamCauseTags] = useState<TeamCauseTagRow[]>([]);

  // ✅ 週サイクル（マトリクス7点）
  const [cycleBaseDate, setCycleBaseDate] = useState<string>(() => getJSTDateKey(new Date()));

  // 選手詳細
  const [selectedAthlete, setSelectedAthlete] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<'athletes' | 'team-average' | 'reports'>('athletes');

  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);

  // ✅ team-average 追加表示のON/OFF
  const [showAvgRPE, setShowAvgRPE] = useState(true);
  const [showAvgLoad, setShowAvgLoad] = useState(false);

  // ===== ACWR request guard（チーム切替対策）=====
  const selectedTeamIdRef = useRef<string | null>(null);
  const acwrRequestSeqRef = useRef(0);

  // ✅ athletes の最新ID集合を常に保持（async内で最新を参照するため）
  const athletesIdsKeyRef = useRef<string>('');

  useEffect(() => {
    selectedTeamIdRef.current = selectedTeam?.id ?? null;
  }, [selectedTeam?.id]);

  useEffect(() => {
    athletesIdsKeyRef.current = athletes.map((a) => a.id).slice().sort().join(',');
  }, [athletes]);

  // 🔔 練習記録なしカード用（今日だけ抑制） ※JST統一
  const todayKey = getJSTDateKey(new Date());
  const [noDataDismissedToday, setNoDataDismissedToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const key = `noDataDismissed-${user.id}-${todayKey}`;
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  // =========================
  // Tutorial / Org
  // =========================
  const {
    isActive,
    shouldShowTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    currentStepIndex,
    setCurrentStepIndex,
  } = useTutorialContext();

  const orgHook = useOrganizations(user.id);
  const organizations = Array.isArray(orgHook?.organizations) ? orgHook.organizations : [];

  // ✅ ここが白画面の最大原因になりがち：一瞬 undefined でも絶対落ちないようにする
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];

  const currentOrganizationId =
    selectedTeam?.organization_id || (safeOrganizations.length > 0 ? safeOrganizations[0].id : '');

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  // =========================
  // Team ACWR (chart用は既存hookを使う)
  // =========================
  const teamACWRHook = useTeamACWR(selectedTeam?.id || null) as any;
  const teamACWRLoading = !!teamACWRHook.loading;
  const teamACWRData = teamACWRHook.teamACWRData ?? teamACWRHook.data ?? [];
  const safeTeamACWRData = Array.isArray(teamACWRData) ? teamACWRData : [];

  // =========================
  // Derived: safe arrays
  // =========================
  const safeAthletes = Array.isArray(athletes) ? athletes : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const safeWeekCards = Array.isArray(weekCards) ? weekCards : [];

  const teamAthleteIds = safeAthletes.map((a) => a.id);
  const teamAlerts = safeAlerts.filter((al) => teamAthleteIds.includes(al.user_id));
  const highPriorityTeamAlerts = teamAlerts.filter((al) => al.priority === 'high');

  // =========================
  // ✅ 週サイクル（チーム全体・日別平均7点）
  // =========================
  const {
    weekRange: cycleWeekRange,
    teamDaily,
    loading: cycleLoading,
    error: cycleError,
  } = useWeeklyGrowthCycle({
    baseDate: cycleBaseDate,
    athleteIds: teamAthleteIds,
  });

  // =========================
  // Effects
  // =========================
  useEffect(() => {
    fetchStaffTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (!selectedTeam?.id) return;

    // 🔑 チーム切替時にリセット
    setAthletes([]);
    setWeekCards([]);
    setTeamCauseTags([]);
    setAthleteACWRMap({});
    setAcwrLoading(false);

    fetchTeamAthletesWithActivity(selectedTeam.id);
    fetchWeekSummary(selectedTeam.id, weekRange.start, weekRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.id, weekRange.start, weekRange.end]);

  // 今日が変わったら localStorage を更新
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `noDataDismissed-${user.id}-${todayKey}`;
    setNoDataDismissedToday(localStorage.getItem(key) === '1');
  }, [user.id, todayKey]);

  // =========================
  // Fetchers
  // =========================
  const fetchStaffTeams = async () => {
    try {
      setLoading(true);

      const { data: staffTeamLinks, error } = await supabase
        .from('staff_team_links')
        .select(
          `
            team_id,
            teams (
              id,
              name,
              created_at,
              organization_id
            )
          `
        )
        .eq('staff_user_id', user.id);

      if (error) throw error;

      const teamsData = (staffTeamLinks || [])
        .map((link: any) => link.teams)
        .filter(Boolean) as Team[];

      setTeams(teamsData || []);

      if (teamsData && teamsData.length > 0) {
        setSelectedTeam(teamsData[0]);
      } else {
        setSelectedTeam(null);
      }
    } catch (error) {
      console.error('Error fetching staff teams:', error);
      setTeams([]);
      setSelectedTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamAthletesWithActivity = async (teamId: string) => {
    try {
      setAthletesLoading(true);
      setAthletesError(null);

      const currentTeamId = teamId;

      const { data, error } = await supabase
        .from('staff_team_athletes_with_activity' as any)
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;

      // ✅ チーム切替中の古いレスポンスは捨てる
      if (selectedTeamIdRef.current !== currentTeamId) return;

      const rows = (data || []) as StaffAthleteWithActivity[];
      setAthletes(rows);

      // ✅ ここでids作って「1回だけ」ACWR取得
      const ids = rows.map((r) => r.id);
      fetchAthleteACWRFromDaily(teamId, ids);
    } catch (e) {
      console.error(e);
      setAthletesError('選手データの取得に失敗しました');
    } finally {
      setAthletesLoading(false);
    }
  };

  // ✅ 週次：cards + cause_tags を同時取得
  const fetchWeekSummary = async (teamId: string, startDate: string, endDate: string) => {
    try {
      setWeekLoading(true);

      const [weekRes, tagsRes] = await Promise.all([
        supabase.rpc('get_coach_week_athlete_cards', {
          p_team_id: teamId,
          p_start_date: startDate,
          p_end_date: endDate,
        }),
        supabase.rpc('get_coach_week_cause_tags', {
          p_team_id: teamId,
          p_start_date: startDate,
          p_end_date: endDate,
        }),
      ]);

      if (weekRes.error) throw weekRes.error;
      if (tagsRes.error) throw tagsRes.error;

      setWeekCards((weekRes.data || []) as CoachWeekAthleteCard[]);
      setTeamCauseTags((tagsRes.data || []) as TeamCauseTagRow[]);
    } catch (e) {
      console.error('Failed to fetch week summary', e);
      setWeekCards([]);
      setTeamCauseTags([]);
    } finally {
      setWeekLoading(false);
    }
  };

  // =========================
  // ✅ ACWR（DB: athlete_acwr_daily）から「直近90日」取得し、各選手の最新のみ採用
  // =========================
  const fetchAthleteACWRFromDaily = async (teamId: string, athleteIds: string[]) => {
    if (!athleteIds || athleteIds.length === 0) {
      if (selectedTeamIdRef.current === teamId) {
        setAthleteACWRMap({});
        setAcwrLoading(false);
      }
      return;
    }

    const reqSeq = ++acwrRequestSeqRef.current;
    const reqIdsKey = athleteIds.slice().sort().join(',');

    try {
      setAcwrLoading(true);

      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 90);

      const fromKey = getJSTDateKey(from);
      const toKey = getJSTDateKey(today);

      const idChunks = chunk(athleteIds, 50);
      const allRows: AthleteACWRDailyRow[] = [];

      for (const ids of idChunks) {
        const { data, error } = await supabase
          .from('athlete_acwr_daily')
          .select('user_id,date,acwr')
          .in('user_id', ids)
          .gte('date', fromKey)
          .lte('date', toKey)
          .order('date', { ascending: false });

        if (error) throw error;
        allRows.push(...((data || []) as AthleteACWRDailyRow[]));
      }

      // ✅ チーム切替 or 新しいリクエストが走ってたら捨てる
      if (selectedTeamIdRef.current !== teamId) return;
      if (reqSeq !== acwrRequestSeqRef.current) return;

      // ✅ athletes集合が変わってたら捨てる（2人→57人バグ対策）
      const currentIdsKey = athletesIdsKeyRef.current;
      if (currentIdsKey !== reqIdsKey) return;

      const newMap: Record<string, AthleteACWRInfo> = {};

      // すでに date desc なので、先に入ったものが「最新」
      for (const r of allRows) {
        if (newMap[r.user_id]) continue;
        const acwr = typeof r.acwr === 'number' && Number.isFinite(r.acwr) ? r.acwr : null;

        newMap[r.user_id] = {
          currentACWR: acwr != null ? round2(acwr) : null,
          riskLevel: acwr != null ? calcRisk(acwr) : undefined,
          daysOfData: 28, // ここは表示用（必要ならviewに合わせて差し替え）
        };
      }

      // 取れなかった選手もキーだけは作る（AthleteListでundefined参照しない）
      for (const id of athleteIds) {
        if (!newMap[id]) {
          newMap[id] = { currentACWR: null, riskLevel: undefined, daysOfData: null };
        }
      }

      setAthleteACWRMap(newMap);
    } catch (e) {
      console.error('[fetchAthleteACWRFromDaily] failed', e);
      if (selectedTeamIdRef.current === teamId) setAthleteACWRMap({});
    } finally {
      if (selectedTeamIdRef.current === teamId) setAcwrLoading(false);
    }
  };

  // =========================
  // Alert handlers（必要なら後で実装）
  // =========================
  const markAsRead = async (alertId: string) => {
    console.log('Mark as read:', alertId);
  };
  const dismissAlert = async (alertId: string) => {
    console.log('Dismiss alert:', alertId);
  };
  const markAllAsRead = async () => {
    console.log('Mark all as read');
  };

  // =========================
  // Derived UI values
  // =========================
  const latestTeamACWR =
    safeTeamACWRData.length > 0 ? safeTeamACWRData[safeTeamACWRData.length - 1] : null;

  const noDataAthletes = useMemo(() => {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    return safeAthletes
      .filter((a) => a.last_training_date)
      .map((a) => {
        const last = new Date(a.last_training_date as string);
        const days = Math.floor((now.getTime() - last.getTime()) / msPerDay);
        return { athlete: a, daysSinceLast: days };
      })
      .filter((x) => x.daysSinceLast >= NO_DATA_DAYS_THRESHOLD)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  }, [safeAthletes]);

  const latestTeamAvg = latestTeamACWR?.averageACWR ?? null;
  const latestValid = latestTeamACWR?.athleteCount ?? 0;
  const roster = safeAthletes.length;

  const summaryTone = getSummaryTone(
    typeof latestTeamAvg === 'number' ? latestTeamAvg : null,
    latestValid,
    roster
  );

  // 🧠 フォーカス一覧 → 選手詳細を開く
  const handleOpenAthleteDetailFromFocus = (it: { user_id: string }) => {
    const target = safeAthletes.find((a) => a.id === it.user_id);

    if (!target) {
      window.alert('選手情報が見つかりませんでした');
      return;
    }

    const card = safeWeekCards.find((c) => c.athlete_user_id === target.id);
    if (card && !card.is_sharing_active) {
      window.alert('この選手は現在、詳細データの共有がOFFです（🔒）');
      return;
    }

    setSelectedAthlete(target);
  };

  type FocusItem = {
    user_id: string;
    name: string;
    category: 'risk' | 'checkin' | 'praise';
    reason: string;
    meta?: string;
  };

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = [];

    // 🟥 注意：記録途切れ
    noDataAthletes.slice(0, 3).forEach(({ athlete, daysSinceLast }) => {
      items.push({
        user_id: athlete.id,
        name: athlete.name || athlete.email || 'unknown',
        category: 'risk',
        reason: '記録が途切れています',
        meta: `${daysSinceLast}日未入力`,
      });
    });

    if (!safeWeekCards || safeWeekCards.length === 0) return items.slice(0, 5);

    // 🟥 注意：ACWR高め（共有ONのみ）
    safeWeekCards.forEach((c) => {
      if (!c.is_sharing_active) return;
      const acwr = athleteACWRMap?.[c.athlete_user_id]?.currentACWR;
      if (typeof acwr === 'number' && acwr >= 1.5) {
        items.push({
          user_id: c.athlete_user_id,
          name: c.athlete_name || 'unknown',
          category: 'risk',
          reason: 'ACWR高値',
          meta: `ACWR ${acwr.toFixed(2)}`,
        });
      }
    });

    // 🟨 声かけ：睡眠が短い
    safeWeekCards.forEach((c) => {
      if (!c.is_sharing_active) return;
      if (c.sleep_hours_avg != null && c.sleep_hours_avg <= 5.5) {
        items.push({
          user_id: c.athlete_user_id,
          name: c.athlete_name || 'unknown',
          category: 'checkin',
          reason: '睡眠が短め',
          meta: `${c.sleep_hours_avg.toFixed(1)}h`,
        });
      }
    });

    // 🟩 称賛：行動目標達成率高い
    safeWeekCards.forEach((c) => {
      if (c.action_total > 0 && (c.action_done_rate ?? 0) >= 90) {
        items.push({
          user_id: c.athlete_user_id,
          name: c.athlete_name || 'unknown',
          category: 'praise',
          reason: '行動目標が良い',
          meta: `${Math.round(c.action_done_rate ?? 0)}%`,
        });
      }
    });

    const priority: Record<FocusItem['category'], number> = {
      risk: 3,
      checkin: 2,
      praise: 1,
    };

    const map = new Map<string, FocusItem>();
    for (const it of items) {
      const prev = map.get(it.user_id);
      if (!prev || priority[it.category] > priority[prev.category]) {
        map.set(it.user_id, it);
      }
    }

    const merged = Array.from(map.values());
    merged.sort((a, b) => priority[b.category] - priority[a.category]);

    return merged.slice(0, 5);
  }, [noDataAthletes, safeWeekCards, athleteACWRMap]);

  const handleDismissNoDataForToday = () => {
    if (typeof window !== 'undefined') {
      const key = `noDataDismissed-${user.id}-${todayKey}`;
      localStorage.setItem(key, '1');
    }
    setNoDataDismissedToday(true);
  };

  const weekCardMap = useMemo(() => {
    const map: Record<string, CoachWeekAthleteCard> = {};
    for (const c of safeWeekCards) map[c.athlete_user_id] = c;
    return map;
  }, [safeWeekCards]);

  const noDataMap = useMemo(() => {
    const map: Record<string, { daysSinceLast: number }> = {};
    for (const x of noDataAthletes) {
      map[x.athlete.id] = { daysSinceLast: x.daysSinceLast };
    }
    return map;
  }, [noDataAthletes]);

  const athleteRiskMap = useMemo(() => {
    const map: Record<string, AthleteRisk> = {};

    for (const a of safeAthletes) {
      map[a.id] = calcRiskForAthlete({
        id: a.id,
        name: a.name || a.email || 'unknown',
        acwrInfo: athleteACWRMap?.[a.id] ?? null, // currentACWR
        weekCard: weekCardMap?.[a.id] ?? null, // is_sharing_active / sleep_hours_avg
        noData: noDataMap?.[a.id] ?? null, // daysSinceLast
      });
    }

    return map;
  }, [safeAthletes, athleteACWRMap, weekCardMap, noDataMap]);

  const sortedAthletes = useMemo(() => {
    return sortAthletesByRisk({
      athletes: safeAthletes,
      riskMap: athleteRiskMap,
      weekCardMap,
    });
  }, [safeAthletes, athleteRiskMap, weekCardMap]);

  useEffect(() => {
    if (!sortedAthletes || sortedAthletes.length === 0) return;

    // riskLevel が入ってる人数
    const withRisk = sortedAthletes.filter((a) => athleteRiskMap?.[a.id]?.riskLevel).length;

    // 70% 以上揃ったらログ
    if (withRisk >= Math.floor(sortedAthletes.length * 0.7)) {
      console.log(
        '[sortedAthletes]',
        sortedAthletes.map((a) => ({
          name: a.name,
          risk: athleteRiskMap[a.id]?.riskLevel,
          sharing: weekCardMap[a.id]?.is_sharing_active,
          acwr: athleteACWRMap[a.id]?.currentACWR,
          reasons: athleteRiskMap[a.id]?.reasons?.length ?? 0,
        }))
      );
    } else {
      console.log(`[sortedAthletes] risk not ready: ${withRisk}/${sortedAthletes.length}`);
    }
  }, [sortedAthletes, athleteRiskMap, weekCardMap, athleteACWRMap]);

  // ✅ 選手クリック：共有🔓以外はモーダルを開かない
  const handleAthleteSelect = (athlete: User) => {
    const card = safeWeekCards.find((c) => c.athlete_user_id === athlete.id);
    if (!card?.is_sharing_active) {
      window.alert('この選手は現在、詳細データの共有がOFFです（🔒）');
      return;
    }
    setSelectedAthlete(athlete);
  };

  // =========================
  // Render
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">コーチダッシュボード</h1>

            <div className="flex items-center space-x-1">
              {/* 🔔 高リスクアラートがある時だけベル表示 */}
              {highPriorityTeamAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertPanel(true)}
                  className="p-2 text-gray-600 hover:text-red-600 transition-colors relative"
                  title="アラート"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {highPriorityTeamAlerts.length}
                  </span>
                </button>
              )}

              <button
                onClick={startTutorial}
                className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Team Selector */}
          {teams.length > 0 && (
            <div className="pb-3 border-t border-gray-100">
              <div className="flex items-center gap-3 pt-3">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const team = teams.find((t) => t.id === e.target.value);
                    if (team) setSelectedTeam(team);
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {teams.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">担当チームがありません</h3>
            <p className="text-gray-600">管理者にチームの割り当てを依頼してください。</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* ✅ 今日のチーム状況（全タブ共通で最上部に表示） */}
            {selectedTeam && (
              <div className="space-y-4">
                {!teamACWRLoading && latestTeamACWR && (
                  <div className={`rounded-xl border p-4 sm:p-5 ${toneStyles[summaryTone].box}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${toneStyles[summaryTone].badge}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${toneStyles[summaryTone].dot}`} />
                            Today Summary
                          </span>

                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-bold ${toneStyles[summaryTone].badge}`}
                          >
                            {getSummaryLabel(summaryTone)}
                          </span>
                        </div>

                        <div className="text-sm sm:text-base text-gray-900 font-semibold">
                          {getSummaryMessage(summaryTone, latestValid, roster)}
                        </div>

                        <div className="mt-2 text-xs sm:text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            チームACWR：<b>{latestTeamACWR.averageACWR}</b>
                          </span>
                          <span>
                            有効人数：<b>{latestValid}</b> / 在籍：<b>{roster}</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!teamACWRLoading && !latestTeamACWR && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                    <div className="text-sm font-semibold text-gray-900 mb-1">Today Summary</div>
                    <div className="text-sm text-gray-700">
                      まだチームACWRを算出できるデータがありません。
                      <br />
                      （選手のRPEと練習時間の入力が増えると表示されます）
                    </div>
                  </div>
                )}

                {/* ✅ フォーカス5人 */}
                {focusItems.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm sm:text-base font-semibold text-gray-900">
                        今日のフォーカス（最大5人）
                      </div>
                      <div className="text-xs text-gray-500">タップで選手詳細</div>
                    </div>

                    <ul className="space-y-2">
                      {focusItems.map((it) => (
                        <li key={it.user_id}>
                          <button
                            onClick={() => handleOpenAthleteDetailFromFocus({ user_id: it.user_id })}
                            className="w-full text-left rounded-lg border border-gray-200 hover:bg-gray-50 px-3 py-2 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{it.name}</div>
                              <div className="text-xs text-gray-700">
                                {it.reason}
                                {it.meta ? <span className="text-gray-500">（{it.meta}）</span> : null}
                              </div>
                            </div>

                            <span
                              className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${
                                it.category === 'risk'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : it.category === 'checkin'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {it.category === 'risk'
                                ? '注意'
                                : it.category === 'checkin'
                                ? '声かけ'
                                : '称賛'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 🆕 練習記録が途切れている選手カード */}
            {noDataAthletes.length > 0 && !noDataDismissedToday && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                      練習記録が途切れている選手
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      最終記録日から一定期間、記録がない選手の一覧です
                    </p>
                  </div>
                  <button
                    onClick={handleDismissNoDataForToday}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50"
                  >
                    今日分は既読にする
                  </button>
                </div>

                <ul className="space-y-1 sm:space-y-1.5 text-sm sm:text-base">
                  {noDataAthletes.map(({ athlete, daysSinceLast }) => (
                    <li
                      key={athlete.id}
                      className="flex items-baseline justify-between border-t border-gray-100 pt-1.5 first:border-t-0 first:pt-0"
                    >
                      <div className="font-medium text-gray-900 truncate mr-2">
                        {athlete.name || athlete.email}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                        最終日 {athlete.last_training_date || '-'}（{daysSinceLast}日間）
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Team Overview */}
            {selectedTeam && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    <span className="hidden sm:inline">{selectedTeam.name} - </span>
                    <span className="sm:hidden">チーム</span>概要
                  </h2>
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 ml-2" />
                </div>

                {teamACWRLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                  </div>
                ) : !latestTeamACWR ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    まだACWRを計算できる十分なトレーニングデータがありません。
                    <br />
                    （選手のRPEと練習時間を入力すると表示されます）
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-purple-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-purple-600 mb-1">
                        {latestTeamACWR.averageACWR}
                      </div>
                      <div className="text-xs sm:text-sm text-purple-700">チーム平均ACWR</div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">
                        {latestTeamACWR.athleteCount}
                      </div>
                      <div className="text-xs sm:text-sm text-blue-700">データ有効選手数</div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-gray-600 mb-1">
                        {safeAthletes.length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-700">総選手数</div>
                    </div>

                    <div className="bg-red-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-600 mb-1">
                        {teamAlerts.filter((al) => al.priority === 'high').length}
                      </div>
                      <div className="text-xs sm:text-sm text-red-700">高リスク選手</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            {selectedTeam && (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="border-b border-gray-200">
                  {/* Desktop tabs */}
                  <nav className="hidden sm:flex px-4 sm:px-6 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('athletes')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'athletes'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      data-tutorial="athletes-tab"
                    >
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        選手一覧
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('team-average')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'team-average'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      data-tutorial="team-average-tab"
                    >
                      <div className="flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        チーム平均ACWR
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('reports')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'reports'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        レポート
                      </div>
                    </button>
                  </nav>

                  {/* Mobile dropdown */}
                  <div className="sm:hidden px-4 py-3">
                    <select
                      value={activeTab}
                      onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="athletes">選手一覧</option>
                      <option value="team-average">チーム平均ACWR</option>
                      <option value="reports">レポート</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {activeTab === 'athletes' && (
                    <div>
                      <div className="text-xs text-gray-600 mb-3 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        共有OFF（🔒）の選手は、詳細モーダルを開けません
                        {acwrLoading && <span className="ml-2 text-xs text-gray-500">（ACWR取得中…）</span>}
                      </div>

                      {athletesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                      ) : athletesError ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                          <div className="font-semibold mb-1">選手一覧の取得に失敗しました</div>
                          <div className="mb-3">{athletesError}</div>
                          <button
                            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                            onClick={() => selectedTeam?.id && fetchTeamAthletesWithActivity(selectedTeam.id)}
                          >
                            再取得
                          </button>
                        </div>
                      ) : safeAthletes.length === 0 ? (
                        <div className="bg-white border rounded-xl p-6 text-center text-gray-600">
                          <div className="font-semibold text-gray-900 mb-1">選手がまだいません</div>
                          <div className="text-sm">
                            チームに選手が所属しているか（team_id / view 条件）を確認してください。
                          </div>
                        </div>
                      ) : (
                        <AthleteList
                          athletes={sortedAthletes}
                          onAthleteSelect={handleAthleteSelect}
                          athleteACWRMap={athleteACWRMap}
                          weekCardMap={weekCardMap}
                          athleteRiskMap={athleteRiskMap}
                        />
                      )}
                    </div>
                  )}

                  {activeTab === 'team-average' && (
                    <div className="space-y-4">
                      {teamACWRLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                        </div>
                      ) : (
                        <ChartErrorBoundary name="TeamACWRChart">
                          <TeamACWRChart
                            data={safeTeamACWRData}
                            teamName={selectedTeam?.name ?? ''}
                            showAvgRPE={showAvgRPE}
                            showAvgLoad={showAvgLoad}
                          />
                        </ChartErrorBoundary>
                      )}

                      {/* ✅ 週サイクル表示（7日分をサイクルとして） */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold text-gray-900">
                              週サイクル表示（7日）
                            </div>
                            <div className="text-xs text-gray-500">
                              指定日を含む週（月〜日）を「成長×理解」の動き＋負荷で可視化します
                            </div>
                          </div>

                          <input
                            type="date"
                            value={cycleBaseDate}
                            onChange={(e) => setCycleBaseDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300"
                            title="この日付を含む週（月〜日）を表示"
                          />
                        </div>

                        <div className="mt-3">
                          {cycleLoading ? (
                            <div className="flex items-center justify-center py-10">
                              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                            </div>
                          ) : cycleError ? (
                            <div className="text-sm text-red-600">{cycleError}</div>
                          ) : (
                            <WeeklyGrowthCycleView
                              teamDaily={teamDaily}
                              weekLabel={`${cycleWeekRange.start} 〜 ${cycleWeekRange.end}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ 週サイクル（1週間をサイクルとして見る） */}
                  <div className="mt-6 space-y-4">
                    <ChartErrorBoundary name="WeeklyGrowthCycleView">
                      {/** 型/props違いで落ちないように any で逃がす */}
                      {React.createElement(WeeklyGrowthCycleView as any, {
                        teamId: selectedTeam?.id,
                        startDate: weekRange.start,
                        endDate: weekRange.end,
                      })}
                    </ChartErrorBoundary>

                    <ChartErrorBoundary name="GrowthUnderstandingQuadrantSummary">
                      {React.createElement(GrowthUnderstandingQuadrantSummary as any, {
                        teamId: selectedTeam?.id,
                        startDate: weekRange.start,
                        endDate: weekRange.end,
                      })}
                    </ChartErrorBoundary>

                    <ChartErrorBoundary name="GrowthUnderstandingMatrix">
                      {React.createElement(GrowthUnderstandingMatrix as any, {
                        teamId: selectedTeam?.id,
                        date: todayKey,
                      })}
                    </ChartErrorBoundary>
                  </div>

                  {activeTab === 'reports' && (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                        </div>
                      }
                    >
                      <ReportView team={selectedTeam!} />
                    </Suspense>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Athlete Detail Modal */}
      {selectedAthlete && (
        <AthleteDetailModal
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
          risk={athleteRiskMap[selectedAthlete.id]}
          weekCard={weekCardMap[selectedAthlete.id]}
        />
      )}

      {/* Alert Panel */}
      {showAlertPanel && (
        <AlertPanel
          alerts={teamAlerts}
          onMarkAsRead={markAsRead}
          onDismiss={dismissAlert}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setShowAlertPanel(false)}
          userRole={user.role}
        />
      )}

      {/* Team Export Panel（将来ボタン追加するなら生きる） */}
      {showExportPanel && selectedTeam && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
            </div>
          }
        >
          <TeamExportPanel team={selectedTeam} onClose={() => setShowExportPanel(false)} />
        </Suspense>
      )}

      <TutorialController
        steps={getTutorialSteps('staff')}
        isActive={isActive}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />
    </div>
  );
}