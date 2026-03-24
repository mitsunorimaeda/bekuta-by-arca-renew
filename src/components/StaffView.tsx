// src/components/StaffView.tsx
import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { Alert } from '../lib/alerts';

import { AthleteDetailModal } from './AthleteDetailModal';
import { TutorialController } from './TutorialController';

import { useTeamACWR } from '../hooks/useTeamACWR';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { useOrganizations } from '../hooks/useOrganizations';
import { calcRiskForAthlete, sortAthletesByRisk, AthleteRisk } from '../lib/riskUtils';
import { useTeamCyclePhases } from '../hooks/useTeamCyclePhases';
import { useWeeklyGrowthCycle } from '../hooks/useWeeklyGrowthCycle';

import CoachAthletePerformanceModal from './CoachAthletePerformanceModal';
import { PerformanceAnalysisPanel } from './PerformanceAnalysisPanel';
import type { CoachRankingsViewProps } from './CoachRankingsView';
import TeamSeasonPhaseSettings from './TeamSeasonPhaseSettings';

import { CoachHeroCard } from './CoachHeroCard';
import { CoachActionCards } from './CoachActionCards';
import type { FocusItem } from './CoachActionCards';
import { CoachAthletesTab } from './CoachAthletesTab';
import { CoachTeamTrendsTab } from './CoachTeamTrendsTab';
import { FrozenAthletesTab } from './FrozenAthletesTab';

// ✅ PostHog Analytics
import { trackEvent } from '../lib/posthog';
import { canAccessRehab } from '../lib/staffPermissions';

// ✅ Plan gating
import { usePlanLimits } from '../hooks/usePlanLimits';
import { UpgradeGate, LockedTabLabel } from './UpgradeGate';

import {
  Users,
  BarChart3,
  Activity,
  HelpCircle,
  FileText,
  Trophy,
  Target,
  Calendar,
  Snowflake,
  Bell,
  MessageSquare,
  Stethoscope,
  ArrowLeft,
  Settings2,
} from 'lucide-react';

// Lazy-loaded components
const TeamExportPanel = lazy(() =>
  import('./TeamExportPanel').then((m) => ({ default: m.TeamExportPanel }))
);
const ReportView = lazy(() =>
  import('./ReportView').then((m) => ({ default: m.ReportView }))
);
const CoachRankingsViewLazy =
  lazy(async () => {
    const m = await import('./CoachRankingsView');
    return { default: m.default };
  }) as React.LazyExoticComponent<React.ComponentType<CoachRankingsViewProps>>;
const NotificationDashboard = lazy(() =>
  import('./NotificationDashboard').then((m) => ({ default: m.NotificationDashboard }))
);
const MessagingPanel = lazy(() =>
  import('./MessagingPanel').then((m) => ({ default: m.MessagingPanel }))
);

// Rehab components (lazy)
const RehabTemplateList = lazy(() => import('./rehab/RehabTemplateList'));
const ProgramDashboard = lazy(() => import('../pages/program-management/ProgramDashboard').then(m => ({ default: m.ProgramDashboard })));
const RehabProgramEditor = lazy(() => import('./rehab/RehabProgramEditor'));
const RehabPrescriptionAssign = lazy(() => import('./rehab/RehabPrescriptionAssign'));
const RehabPrescriptionView = lazy(() => import('./rehab/RehabPrescriptionView'));
const BulkPrescriptionAssign = lazy(() => import('./rehab/BulkPrescriptionAssign'));

// -------------------------
// Types
// -------------------------
interface StaffViewProps {
  user: User;
  alerts: Alert[];
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

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

type AthleteACWRInfo = {
  currentACWR: number | null;
  acute7d?: number | null;
  chronicLoad?: number | null;
  dailyLoad?: number | null;
  riskLevel?: RiskLevel;
  daysOfData?: number | null;
  lastDate?: string | null;
};

type RiskLevel = 'high' | 'caution' | 'good' | 'low' | 'unknown';
type SummaryTone = 'danger' | 'warn' | 'ok' | 'unknown';

// -------------------------
// Constants & Helpers
// -------------------------
const NO_DATA_DAYS_THRESHOLD = 14;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const getJSTDateKey = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const getThisWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: toISODate(mon), end: toISODate(sun) };
};

const calcRisk = (acwr: number): RiskLevel => {
  if (acwr >= 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';
};

const getSummaryTone = (avg: number | null, valid: number, roster: number): SummaryTone => {
  const minValid = Math.min(5, Math.max(1, Math.floor(roster * 0.2)));
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

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

// -------------------------
// Component
// -------------------------
export function StaffView({
  user,
  alerts,
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

  const [athleteACWRMap, setAthleteACWRMap] = useState<Record<string, AthleteACWRInfo>>({});
  const [acwrLoading, setAcwrLoading] = useState(false);

  const [weekRange] = useState(() => getThisWeekRange());
  const [weekCards, setWeekCards] = useState<CoachWeekAthleteCard[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [teamCauseTags, setTeamCauseTags] = useState<TeamCauseTagRow[]>([]);

  const [cycleBaseDate, setCycleBaseDate] = useState<string>(() => getJSTDateKey(new Date()));

  const [selectedAthlete, setSelectedAthlete] = useState<User | null>(null);

  // rehabAthleteIds の state だけここで宣言（useEffect は safeAthletes 定義後に配置）
  const [rehabAthleteIds, setRehabAthleteIds] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'athletes' | 'team-trends' | 'frozen' | 'rankings' | 'reports' | 'settings' | 'performance' | 'notifications' | 'messages' | 'rehab-programs'>('athletes');
  const [activeMainTab, setActiveMainTab] = useState<'athletes' | 'analysis' | 'communication' | 'management'>('athletes');
  const [showMoreTabs, setShowMoreTabs] = useState(false);

  // メインタブ変更時にサブタブも連動
  const handleMainTabChange = (mainTab: typeof activeMainTab) => {
    setActiveMainTab(mainTab);
    const defaultSubTabs: Record<typeof activeMainTab, typeof activeTab> = {
      athletes: 'athletes',
      analysis: 'team-trends',
      communication: 'messages',
      management: 'settings',
    };
    setActiveTab(defaultSubTabs[mainTab]);
  };

  // リハビリ: フルスクリーンビュー管理
  const [fullscreenView, setFullscreenView] = useState<
    | { type: 'editor'; templateId?: string }
    | { type: 'assign'; athleteId: string; injuryId?: string; fromPrescriptionId?: string; purpose?: string }
    | { type: 'view-prescription'; prescriptionId: string; athleteId: string }
    | { type: 'bulk-assign' }
    | null
  >(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    window.alert(msg); // TODO: bekuta の toast システムに接続
  };

  // ✅ 未読メッセージ数
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);
        setUnreadMessageCount(count ?? 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // 60秒ごとに更新
    return () => clearInterval(interval);
  }, [user.id]);

  // メッセージタブへの直接遷移（AthleteDetailModalから）
  const [messageTargetAthleteId, setMessageTargetAthleteId] = useState<string | null>(null);
  const handleOpenMessageToAthlete = (athleteId: string) => {
    setMessageTargetAthleteId(athleteId);
    setSelectedAthlete(null); // モーダルを閉じる
    setActiveTab('messages');
  };

  // Rankings -> Performance Modal
  type MetricKey = 'primary_value' | 'relative_1rm';
  const [perfModal, setPerfModal] = useState<{
    open: boolean;
    athleteUserId: string;
    athleteName: string;
    testTypeId: string;
    metricKey: MetricKey;
  }>({
    open: false,
    athleteUserId: '',
    athleteName: '',
    testTypeId: '',
    metricKey: 'primary_value',
  });

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showAvgRPE] = useState(true);
  const [showAvgLoad] = useState(false);

  // ACWR request guard
  const selectedTeamIdRef = useRef<string | null>(null);
  const acwrRequestSeqRef = useRef(0);
  const athletesIdsKeyRef = useRef<string>('');

  // ✅ PostHog: コーチダッシュボード閲覧トラッキング
  useEffect(() => {
    trackEvent('coach_dashboard_viewed', { team_id: selectedTeam?.id });
  }, []);

  useEffect(() => {
    selectedTeamIdRef.current = selectedTeam?.id ?? null;
  }, [selectedTeam?.id]);

  useEffect(() => {
    athletesIdsKeyRef.current = athletes.map((a) => a.id).slice().sort().join(',');
  }, [athletes]);

  const todayKey = getJSTDateKey(new Date());
  const [noDataDismissedToday, setNoDataDismissedToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(`noDataDismissed-${user.id}-${todayKey}`) === '1';
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
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  const currentOrganizationId =
    selectedTeam?.organization_id || (safeOrganizations.length > 0 ? safeOrganizations[0].id : '');

  // ✅ Plan-based feature gating
  const planLimits = usePlanLimits(currentOrganizationId || null);

  useEffect(() => {
    if (shouldShowTutorial() && !loading) startTutorial();
  }, [shouldShowTutorial, startTutorial, loading]);

  // =========================
  // Team ACWR
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

  const teamAlerts = useMemo(() => {
    const tid = selectedTeam?.id;
    if (!tid) return safeAlerts;
    return safeAlerts.filter((al: any) => {
      if (al?.team_id == null) return true;
      return al.team_id === tid;
    });
  }, [safeAlerts, selectedTeam?.id]);

  const teamAthleteIds = useMemo(() => safeAthletes.map((a) => a.id), [safeAthletes]);

  // リハビリ中選手ID取得（safeAthletes 定義後に配置）
  useEffect(() => {
    if (!selectedTeam?.id) return;
    const ids = safeAthletes.map(a => a.id);
    if (ids.length === 0) { setRehabAthleteIds(new Set()); return; }
    supabase.schema('rehab').from('injuries')
      .select('athlete_user_id')
      .in('athlete_user_id', ids)
      .in('status', ['active', 'conditioning'])
      .then(({ data }) => {
        setRehabAthleteIds(new Set(data?.map(d => d.athlete_user_id) || []));
      });
  }, [selectedTeam?.id, safeAthletes]);

  // =========================
  // Weekly Growth Cycle
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
    setAthletes([]);
    setWeekCards([]);
    setTeamCauseTags([]);
    setAthleteACWRMap({});
    setAcwrLoading(false);
    fetchTeamAthletesWithActivity(selectedTeam.id);
    fetchWeekSummary(selectedTeam.id, weekRange.start, weekRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.id, weekRange.start, weekRange.end]);

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
        .select(`team_id, teams (id, name, created_at, organization_id)`)
        .eq('staff_user_id', user.id);
      if (error) throw error;
      const teamsData = (staffTeamLinks || [])
        .map((link: any) => link.teams)
        .filter(Boolean) as Team[];
      setTeams(teamsData || []);
      if (teamsData && teamsData.length > 0) setSelectedTeam(teamsData[0]);
      else setSelectedTeam(null);
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
      if (selectedTeamIdRef.current !== currentTeamId) return;
      const rows = (data || []) as StaffAthleteWithActivity[];
      setAthletes(rows);
      const ids = rows.map((r) => r.id);
      athletesIdsKeyRef.current = ids.slice().sort().join(',');
      fetchAthleteACWRFromDaily(teamId, ids);
    } catch (e) {
      console.error(e);
      setAthletesError('選手データの取得に失敗しました');
    } finally {
      setAthletesLoading(false);
    }
  };

  const fetchWeekSummary = async (teamId: string, startDate: string, endDate: string) => {
    try {
      setWeekLoading(true);
      const [weekRes, tagsRes] = await Promise.all([
        supabase.rpc('get_coach_week_athlete_cards', { p_team_id: teamId, p_start_date: startDate, p_end_date: endDate }),
        supabase.rpc('get_coach_week_cause_tags', { p_team_id: teamId, p_start_date: startDate, p_end_date: endDate }),
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

  const calcRiskLevelFromACWR = (acwr: number | null): RiskLevel | undefined => {
    if (acwr == null || !Number.isFinite(acwr) || acwr <= 0) return undefined;
    return calcRisk(acwr);
  };

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
      const allRows: any[] = [];

      for (const ids of idChunks) {
        const { data, error } = await supabase
          .from('athlete_acwr_daily')
          .select('user_id,date,acwr,days_of_data,acute_7d,chronic_load,daily_load')
          .in('user_id', ids)
          .gte('date', fromKey)
          .lte('date', toKey)
          .order('date', { ascending: false });
        if (error) throw error;
        allRows.push(...((data || []) as any[]));
      }

      // request guard
      if (selectedTeamIdRef.current !== teamId) return;
      if (reqSeq !== acwrRequestSeqRef.current) return;
      if (athletesIdsKeyRef.current !== reqIdsKey) return;

      const toNum = (v: any): number | null => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const newMap: Record<string, AthleteACWRInfo> = {};
      for (const r of allRows) {
        if (newMap[r.user_id]) continue;
        const acwr = toNum(r.acwr);
        newMap[r.user_id] = {
          currentACWR: acwr,
          acute7d: toNum(r.acute_7d),
          chronicLoad: toNum(r.chronic_load),
          dailyLoad: toNum(r.daily_load),
          daysOfData: toNum(r.days_of_data),
          lastDate: r.date ?? null,
          riskLevel: calcRiskLevelFromACWR(acwr) ?? 'unknown',
        };
      }

      for (const id of athleteIds) {
        if (!newMap[id]) {
          newMap[id] = { currentACWR: null, riskLevel: 'unknown', daysOfData: null, lastDate: null };
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

  const handleOpenAthleteDetailFromFocus = (it: { user_id: string }) => {
    const target = safeAthletes.find((a) => a.id === it.user_id);
    if (!target) { window.alert('選手情報が見つかりませんでした'); return; }
    setSelectedAthlete(target);
  };

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = [];

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

    safeWeekCards.forEach((c) => {
      const acwr = athleteACWRMap?.[c.athlete_user_id]?.currentACWR;
      if (typeof acwr === 'number' && acwr >= 1.5) {
        items.push({ user_id: c.athlete_user_id, name: c.athlete_name || 'unknown', category: 'risk', reason: 'ACWR高値', meta: `ACWR ${acwr.toFixed(2)}` });
      }
    });

    safeWeekCards.forEach((c) => {
      if (c.sleep_hours_avg != null && c.sleep_hours_avg <= 5.5) {
        items.push({ user_id: c.athlete_user_id, name: c.athlete_name || 'unknown', category: 'checkin', reason: '睡眠が短め', meta: `${c.sleep_hours_avg.toFixed(1)}h` });
      }
    });

    safeWeekCards.forEach((c) => {
      if (c.action_total > 0 && (c.action_done_rate ?? 0) >= 90) {
        items.push({ user_id: c.athlete_user_id, name: c.athlete_name || 'unknown', category: 'praise', reason: '行動目標が良い', meta: `${Math.round(c.action_done_rate ?? 0)}%` });
      }
    });

    const priority: Record<FocusItem['category'], number> = { risk: 3, checkin: 2, praise: 1 };
    const map = new Map<string, FocusItem>();
    for (const it of items) {
      const prev = map.get(it.user_id);
      if (!prev || priority[it.category] > priority[prev.category]) map.set(it.user_id, it);
    }
    const merged = Array.from(map.values());
    merged.sort((a, b) => priority[b.category] - priority[a.category]);
    return merged.slice(0, 5);
  }, [noDataAthletes, safeWeekCards, athleteACWRMap]);

  const handleDismissNoDataForToday = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`noDataDismissed-${user.id}-${todayKey}`, '1');
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
    for (const x of noDataAthletes) map[x.athlete.id] = { daysSinceLast: x.daysSinceLast };
    return map;
  }, [noDataAthletes]);

  // Menstrual cycle phases for risk
  const femaleAthleteIds = useMemo(
    () => safeAthletes.filter(a => a.gender === 'female' || a.gender === '女性').map(a => a.id),
    [safeAthletes]
  );
  const { phaseMap: cyclePhaseMap } = useTeamCyclePhases(femaleAthleteIds);

  const athleteRiskMap = useMemo(() => {
    const map: Record<string, AthleteRisk> = {};
    for (const a of safeAthletes) {
      map[a.id] = calcRiskForAthlete({
        id: a.id,
        name: a.name || a.email || 'unknown',
        acwrInfo: athleteACWRMap?.[a.id] ?? null,
        weekCard: weekCardMap?.[a.id] ?? null,
        noData: noDataMap?.[a.id] ?? null,
        cyclePhase: cyclePhaseMap[a.id]?.phase ?? null,
      });
    }
    return map;
  }, [safeAthletes, athleteACWRMap, weekCardMap, noDataMap, cyclePhaseMap]);

  const sortedAthletes = useMemo(() => {
    return sortAthletesByRisk({ athletes: safeAthletes, riskMap: athleteRiskMap, weekCardMap });
  }, [safeAthletes, athleteRiskMap, weekCardMap]);

  const handleAthleteSelect = (athlete: User) => {
    setSelectedAthlete(athlete);
    trackEvent('athlete_detail_opened', { athlete_id: athlete.id, athlete_name: athlete.name });
  };

  // Risk counts for hero card
  const riskCount = useMemo(() => {
    const high = safeAthletes.filter(a => athleteRiskMap[a.id]?.riskLevel === 'high').length;
    const caution = safeAthletes.filter(a => athleteRiskMap[a.id]?.riskLevel === 'caution').length;
    return { high, caution };
  }, [safeAthletes, athleteRiskMap]);

  // =========================
  // Render
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  // フルスクリーンビュー（エディタ・処方割当）
  if (fullscreenView) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-30">
          <button
            onClick={() => setFullscreenView(null)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            <ArrowLeft size={18} /> 戻る
          </button>
        </div>
        <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
          {fullscreenView.type === 'editor' && (
            <RehabProgramEditor
              templateId={fullscreenView.templateId}
              onBack={() => setFullscreenView(null)}
              showToast={showToast}
            />
          )}
          {fullscreenView.type === 'assign' && (
            <RehabPrescriptionAssign
              athleteId={fullscreenView.athleteId}
              injuryId={fullscreenView.injuryId}
              fromPrescriptionId={fullscreenView.fromPrescriptionId}
              purpose={(fullscreenView.purpose as any) || 'rehab'}
              onBack={() => {
                setFullscreenView(null);
              }}
              showToast={showToast}
            />
          )}
          {fullscreenView.type === 'view-prescription' && (
            <RehabPrescriptionView
              prescriptionId={fullscreenView.prescriptionId}
              athleteId={fullscreenView.athleteId}
              onBack={() => setFullscreenView(null)}
              onEdit={(presId, athId) => setFullscreenView({ type: 'assign', athleteId: athId, fromPrescriptionId: presId })}
            />
          )}
          {fullscreenView.type === 'bulk-assign' && (
            <BulkPrescriptionAssign
              onBack={() => setFullscreenView(null)}
              showToast={showToast}
              athletes={safeAthletes.map(a => ({ id: a.id, name: a.name ?? '', team_id: a.team_id }))}
            />
          )}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Team selector bar */}
      {teams.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-30 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <select
                value={selectedTeam?.id || ''}
                onChange={(e) => {
                  const team = teams.find((t) => t.id === e.target.value);
                  if (team) setSelectedTeam(team);
                }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <button
                onClick={startTutorial}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="チュートリアル"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {teams.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">担当チームがありません</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">管理者にチームの割り当てを依頼してください。</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Hero Card */}
            {selectedTeam && (
              <CoachHeroCard
                teamName={selectedTeam.name}
                summaryTone={summaryTone}
                summaryMessage={getSummaryMessage(summaryTone, latestValid, roster)}
                summaryLabel={getSummaryLabel(summaryTone)}
                roster={roster}
                averageACWR={latestTeamACWR?.averageACWR ?? null}
                validCount={latestValid}
                riskHigh={riskCount.high}
                riskCaution={riskCount.caution}
                loading={teamACWRLoading}
              />
            )}

            {/* Action Cards */}
            {selectedTeam && focusItems.length > 0 && (
              <CoachActionCards
                focusItems={focusItems}
                riskHigh={riskCount.high}
                riskCaution={riskCount.caution}
                onOpenAthlete={handleOpenAthleteDetailFromFocus}
              />
            )}

            {/* No Data Warning */}
            {noDataAthletes.length > 0 && !noDataDismissedToday && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 p-4 sm:p-5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5">
                      練習記録が途切れている選手
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      最終記録日から{NO_DATA_DAYS_THRESHOLD}日以上未入力
                    </p>
                  </div>
                  <button
                    onClick={handleDismissNoDataForToday}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    既読にする
                  </button>
                </div>
                <ul className="space-y-1">
                  {noDataAthletes.map(({ athlete, daysSinceLast }) => (
                    <li key={athlete.id} className="flex items-baseline justify-between border-t border-gray-100 dark:border-gray-700 pt-1.5 first:border-t-0 first:pt-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate mr-2">
                        {athlete.name || athlete.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {daysSinceLast}日間未入力
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tab Navigation */}
            {selectedTeam && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm transition-colors">
                {/* Main tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="hidden sm:flex px-4 sm:px-6 overflow-x-auto scrollbar-hide">
                    {([
                      { key: 'athletes' as const, icon: Activity, label: '選手' },
                      { key: 'analysis' as const, icon: Target, label: '分析' },
                      { key: 'communication' as const, icon: MessageSquare, label: 'コミュニケーション', badge: unreadMessageCount },
                      { key: 'management' as const, icon: Settings2, label: '管理' },
                    ] as const).map(({ key, icon: Icon, label, badge }) => (
                      <button
                        key={key}
                        onClick={() => handleMainTabChange(key)}
                        className={`py-3.5 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                          activeMainTab === key
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                        }`}
                        data-tutorial={key === 'athletes' ? 'athletes-tab' : key === 'analysis' ? 'team-average-tab' : undefined}
                      >
                        <div className="flex items-center gap-2 relative">
                          <Icon className="w-4 h-4" />
                          {label}
                          {badge && badge > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {badge > 9 ? '9+' : badge}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </nav>

                  {/* Mobile main tab selector */}
                  <div className="sm:hidden px-4 py-2">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                      {([
                        { key: 'athletes' as const, label: '選手' },
                        { key: 'analysis' as const, label: '分析' },
                        { key: 'communication' as const, label: 'コミュニケーション', badge: unreadMessageCount },
                        { key: 'management' as const, label: '管理' },
                      ] as const).map(({ key, label, badge }) => (
                        <button
                          key={key}
                          onClick={() => handleMainTabChange(key)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                            activeMainTab === key
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {label}
                          {badge && badge > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {badge > 9 ? '9+' : badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                {activeMainTab !== 'athletes' && (
                  <div className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                    <nav className="flex px-4 sm:px-6 overflow-x-auto scrollbar-hide">
                      {activeMainTab === 'analysis' && (
                        <>
                          {[
                            { key: 'team-trends' as const, label: 'チーム傾向', locked: false },
                            { key: 'rankings' as const, label: 'ランキング', locked: !planLimits.canUseRankings },
                            { key: 'performance' as const, label: 'パフォーマンス', locked: !planLimits.canUsePerformanceTesting },
                            { key: 'reports' as const, label: 'レポート', locked: !planLimits.canGenerateReports },
                          ].map(({ key, label, locked }) => (
                            <button
                              key={key}
                              onClick={() => setActiveTab(key)}
                              className={`py-2.5 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                                activeTab === key
                                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                              }`}
                            >
                              <LockedTabLabel label={label} locked={locked} />
                            </button>
                          ))}
                        </>
                      )}

                      {activeMainTab === 'communication' && (
                        <>
                          {[
                            { key: 'messages' as const, label: 'メッセージ' },
                            { key: 'notifications' as const, label: '通知管理' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setActiveTab(key)}
                              className={`py-2.5 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                                activeTab === key
                                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                              }`}
                            >
                              {label}
                              {key === 'messages' && unreadMessageCount > 0 && activeTab !== 'messages' && (
                                <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">
                                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      )}

                      {activeMainTab === 'management' && (
                        <>
                          {[
                            { key: 'settings' as const, label: 'フェーズ設定', locked: false },
                            { key: 'frozen' as const, label: '凍結選手', locked: false },
                            ...(canAccessRehab(user.staff_type) ? [{ key: 'rehab-programs' as const, label: 'プログラム', locked: !planLimits.canUseRehab }] : []),
                          ].map(({ key, label, locked }) => (
                            <button
                              key={key}
                              onClick={() => setActiveTab(key)}
                              className={`py-2.5 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                                activeTab === key
                                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                              }`}
                            >
                              <LockedTabLabel label={label} locked={locked} />
                            </button>
                          ))}
                        </>
                      )}
                    </nav>
                  </div>
                )}

                {/* Tab Content */}
                <div className="p-4 sm:p-6">
                  {activeTab === 'athletes' && (
                    <CoachAthletesTab
                      athletes={sortedAthletes}
                      athletesLoading={athletesLoading}
                      athletesError={athletesError}
                      acwrLoading={acwrLoading}
                      athleteACWRMap={athleteACWRMap}
                      weekCardMap={weekCardMap}
                      athleteRiskMap={athleteRiskMap}
                      cyclePhaseMap={cyclePhaseMap}
                      onAthleteSelect={handleAthleteSelect}
                      onRetry={() => selectedTeam?.id && fetchTeamAthletesWithActivity(selectedTeam.id)}
                      rehabAthleteIds={rehabAthleteIds}
                    />
                  )}

                  {activeTab === 'team-trends' && (
                    <CoachTeamTrendsTab
                      teamId={selectedTeam!.id}
                      teamName={selectedTeam?.name ?? ''}
                      teamACWRData={safeTeamACWRData}
                      teamACWRLoading={teamACWRLoading}
                      showAvgRPE={showAvgRPE}
                      showAvgLoad={showAvgLoad}
                      cycleBaseDate={cycleBaseDate}
                      onCycleBaseDateChange={setCycleBaseDate}
                      cycleLoading={cycleLoading}
                      cycleError={cycleError}
                      teamDaily={teamDaily}
                      cycleWeekLabel={`${cycleWeekRange.start} 〜 ${cycleWeekRange.end}`}
                    />
                  )}

                  {activeTab === 'frozen' && selectedTeam && (
                    <FrozenAthletesTab
                      teamId={selectedTeam.id}
                      onAthleteSelect={handleAthleteSelect}
                    />
                  )}

                  {activeTab === 'rankings' && (
                    <UpgradeGate allowed={planLimits.canUseRankings} featureName="ランキング">
                    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>}>
                      <CoachRankingsViewLazy
                        team={selectedTeam!}
                        onOpenAthlete={(userId, testTypeId, metric, athleteName) => {
                          setPerfModal({ open: true, athleteUserId: userId, athleteName: athleteName || '名前未設定', testTypeId, metricKey: metric });
                        }}
                      />
                    </Suspense>
                    </UpgradeGate>
                  )}

                  {activeTab === 'settings' && selectedTeam && (
                    <TeamSeasonPhaseSettings teamId={selectedTeam.id} teamName={selectedTeam.name} />
                  )}

                  {activeTab === 'reports' && (
                    <UpgradeGate allowed={planLimits.canGenerateReports} featureName="レポート生成">
                    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>}>
                      <ReportView team={selectedTeam!} />
                    </Suspense>
                    </UpgradeGate>
                  )}

                  {activeTab === 'performance' && (
                    <UpgradeGate allowed={planLimits.canUsePerformanceTesting} featureName="パフォーマンス分析">
                    <PerformanceAnalysisPanel
                      organizationId={currentOrganizationId}
                      allowOrgFilter={false}
                      presetTeamId={selectedTeam?.id}
                    />
                    </UpgradeGate>
                  )}

                  {activeTab === 'notifications' && selectedTeam && (
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
                      <NotificationDashboard
                        teamId={selectedTeam.id}
                        teamName={selectedTeam.name}
                        athletes={safeAthletes.map((a) => ({ id: a.id, name: a.name ?? '' }))}
                        userId={user.id}
                        userName={user.name}
                        pushLimit={planLimits.pushLimit}
                        organizationId={currentOrganizationId || undefined}
                      />
                    </Suspense>
                  )}

                  {activeTab === 'messages' && (
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
                      <MessagingPanel
                        userId={user.id}
                        userName={user.name ?? user.email ?? ''}
                        onClose={() => setActiveTab('athletes')}
                      />
                    </Suspense>
                  )}

                  {activeTab === 'rehab-programs' && selectedTeam && (
                    <UpgradeGate allowed={planLimits.canUseRehab} featureName="プログラム管理">
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
                      <ProgramDashboard
                        teamId={selectedTeam.id}
                        teamName={selectedTeam.name}
                        onOpenKarte={(athleteId, injuryId) => {
                          const athlete = safeAthletes.find(a => a.id === athleteId);
                          if (athlete) setSelectedAthlete(athlete);
                        }}
                        onCreateProgram={(athleteId) => {
                          if (athleteId) {
                            const athlete = safeAthletes.find(a => a.id === athleteId);
                            if (athlete) setSelectedAthlete(athlete);
                          }
                          setFullscreenView({ type: 'assign' });
                        }}
                        onBack={() => setActiveTab('athletes')}
                      />
                    </Suspense>
                    </UpgradeGate>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedAthlete && (
        <AthleteDetailModal
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
          risk={athleteRiskMap[selectedAthlete.id]}
          weekCard={weekCardMap[selectedAthlete.id]}
          currentUserId={user.id}
          canFreeze={true}
          onFrozenChange={() => {
            if (selectedTeam?.id) fetchTeamAthletesWithActivity(selectedTeam.id);
          }}
          onOpenMessage={handleOpenMessageToAthlete}
          onOpenRehabAssign={canAccessRehab(user.staff_type) ? (athleteId, injuryId, purpose) => {
            setSelectedAthlete(null);
            setFullscreenView({ type: 'assign', athleteId, injuryId, purpose });
          } : undefined}
          onOpenPrescription={canAccessRehab(user.staff_type) ? (prescriptionId, athleteId) => {
            setSelectedAthlete(null);
            setFullscreenView({ type: 'view-prescription', prescriptionId, athleteId });
          } : undefined}
        />
      )}

      {showExportPanel && selectedTeam && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" /></div>}>
          <TeamExportPanel team={selectedTeam} onClose={() => setShowExportPanel(false)} />
        </Suspense>
      )}

      <CoachAthletePerformanceModal
        open={perfModal.open}
        onClose={() => setPerfModal((p) => ({ ...p, open: false }))}
        teamId={selectedTeam?.id ?? ''}
        athleteUserId={perfModal.athleteUserId}
        athleteName={perfModal.athleteName}
        testTypeId={perfModal.testTypeId}
        metricKey={perfModal.metricKey}
      />

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
