import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { getTodayJSTString } from '../lib/date';
import { Download, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const ATHLETE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#6366F1', '#EC4899', '#14B8A6', '#F97316',
];

interface PerformanceAnalysisPanelProps {
  organizationId: string | 'ALL';
  allowOrgFilter: boolean;
  presetTeamId?: string;
}

interface Org { id: string; name: string; }
interface Team { id: string; name: string; }
interface Athlete { id: string; name: string; }
interface Category { id: string; name: string; display_name: string; }
interface TestType { id: string; name: string; display_name: string; unit: string; higher_is_better: boolean; }
interface PerformanceRecord {
  id: string;
  user_id: string;
  date: string;
  values: Record<string, unknown>;
  is_official: boolean;
  notes?: string;
  users: { id: string; name: string };
  performance_test_types: { id: string; name: string; display_name: string; unit: string; higher_is_better: boolean };
}

type PeriodPreset = '1month' | '3months' | '6months' | '1year' | 'custom';
type SortField = 'name' | 'date' | 'value';
type SortDir = 'asc' | 'desc';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '1month': '1ヶ月',
  '3months': '3ヶ月',
  '6months': '6ヶ月',
  '1year': '1年',
  'custom': 'カスタム',
};

function computeStartDate(preset: PeriodPreset): string {
  const today = new Date(getTodayJSTString());
  switch (preset) {
    case '1month':  today.setMonth(today.getMonth() - 1); break;
    case '3months': today.setMonth(today.getMonth() - 3); break;
    case '6months': today.setMonth(today.getMonth() - 6); break;
    case '1year':   today.setFullYear(today.getFullYear() - 1); break;
    default: break;
  }
  return today.toISOString().split('T')[0];
}

function getRecordValue(values: Record<string, unknown>): number | null {
  const raw = (values as any)?.primary_value;
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  return Number.isFinite(num) ? num : null;
}

export function PerformanceAnalysisPanel({
  organizationId,
  allowOrgFilter,
  presetTeamId,
}: PerformanceAnalysisPanelProps) {
  // --- Filter state ---
  const [selectedOrgId, setSelectedOrgId] = useState(
    organizationId === 'ALL' ? '' : organizationId
  );
  const [selectedTeamId, setSelectedTeamId] = useState(presetTeamId || '');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTestTypeId, setSelectedTestTypeId] = useState('');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('3months');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // --- Data state ---
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [athleteLoading, setAthleteLoading] = useState(false);

  // --- Table sort state ---
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Computed period
  const today = getTodayJSTString();
  const startDate = periodPreset === 'custom' ? customStartDate : computeStartDate(periodPreset);
  const endDate = periodPreset === 'custom' ? customEndDate : today;

  // Sync when parent's presetTeamId changes (e.g. staff switches team)
  useEffect(() => {
    if (presetTeamId !== undefined) setSelectedTeamId(presetTeamId);
  }, [presetTeamId]);

  // Sync when parent's organizationId changes
  useEffect(() => {
    setSelectedOrgId(organizationId === 'ALL' ? '' : organizationId);
    if (!presetTeamId) setSelectedTeamId('');
  }, [organizationId, presetTeamId]);

  // --- Fetch organizations (admin only) ---
  useEffect(() => {
    if (!allowOrgFilter) return;
    supabase.from('organizations').select('id, name').order('name')
      .then(({ data }) => setOrgs(data || []));
  }, [allowOrgFilter]);

  // --- Fetch teams (admin only, when org is selected) ---
  useEffect(() => {
    if (!allowOrgFilter) return;
    if (!selectedOrgId) { setTeams([]); setSelectedTeamId(''); return; }
    supabase.from('teams').select('id, name').eq('organization_id', selectedOrgId).order('name')
      .then(({ data }) => setTeams(data || []));
  }, [allowOrgFilter, selectedOrgId]);

  // --- Fetch athletes when team changes ---
  useEffect(() => {
    if (!selectedTeamId) { setAthletes([]); setSelectedAthleteIds([]); return; }
    setAthleteLoading(true);
    supabase
      .from('staff_team_athletes_with_activity' as any)
      .select('id, name')
      .eq('team_id', selectedTeamId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[athletes fetch error]', error);
          setAthletes([]);
          setSelectedAthleteIds([]);
        } else {
          const list: Athlete[] = (data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
          }));
          list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
          setAthletes(list);
          setSelectedAthleteIds(list.map((a) => a.id));
        }
        setAthleteLoading(false);
      });
  }, [selectedTeamId]);

  // --- Fetch categories ---
  useEffect(() => {
    supabase.from('performance_categories').select('id, name, display_name')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories(data || []));
  }, []);

  // --- Fetch test types when category changes ---
  useEffect(() => {
    if (!selectedCategoryId) { setTestTypes([]); setSelectedTestTypeId(''); return; }
    supabase.from('performance_test_types')
      .select('id, name, display_name, unit, higher_is_better')
      .eq('category_id', selectedCategoryId).eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const list = data || [];
        setTestTypes(list);
        setSelectedTestTypeId(list[0]?.id || '');
      });
  }, [selectedCategoryId]);

  // --- Fetch performance records ---
  const fetchRecords = useCallback(async () => {
    if (!selectedTestTypeId || selectedAthleteIds.length === 0 || !startDate || !endDate) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('performance_records')
      .select(`
        id, user_id, date, values, is_official, notes,
        users:user_id(id, name),
        performance_test_types:test_type_id(id, name, display_name, unit, higher_is_better)
      `)
      .in('user_id', selectedAthleteIds)
      .eq('test_type_id', selectedTestTypeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    if (error) {
      console.error('[performance_records fetch error]', error);
      setFetchError(error.message);
      setRecords([]);
    } else {
      setRecords((data || []) as unknown as PerformanceRecord[]);
    }
    setLoading(false);
  }, [selectedTestTypeId, selectedAthleteIds, startDate, endDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // --- Derived data ---
  const selectedTestType = testTypes.find((t) => t.id === selectedTestTypeId);
  const unit = selectedTestType?.unit || '';

  const athleteById = useMemo(() => {
    const map: Record<string, Athlete> = {};
    athletes.forEach((a) => (map[a.id] = a));
    return map;
  }, [athletes]);

  // Build Recharts data: [{date, fullDate, athleteId: value, ...}]
  const chartData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    records.forEach((r) => {
      const v = getRecordValue(r.values);
      if (v === null) return;
      if (!dateMap[r.date]) dateMap[r.date] = {};
      dateMap[r.date][r.user_id] = v;
    });
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        fullDate: date,
        ...vals,
      }));
  }, [records]);

  // Athletes with at least one record in filtered set
  const activeAthleteIds = useMemo(() => {
    const ids = new Set(records.map((r) => r.user_id));
    return selectedAthleteIds.filter((id) => ids.has(id));
  }, [records, selectedAthleteIds]);

  // Table rows (sorted)
  const tableRows = useMemo(() => {
    const rows = records.map((r) => ({
      id: r.id,
      name: (r.users as any)?.name || athleteById[r.user_id]?.name || r.user_id,
      date: r.date,
      value: getRecordValue(r.values),
      unit,
      is_official: r.is_official,
      notes: r.notes || '',
    }));
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name')  cmp = a.name.localeCompare(b.name, 'ja');
      else if (sortField === 'date')  cmp = a.date.localeCompare(b.date);
      else if (sortField === 'value') cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [records, sortField, sortDir, unit, athleteById]);

  // --- CSV export ---
  const handleExport = () => {
    if (tableRows.length === 0) return;
    const testTypeName = selectedTestType?.display_name || '';
    const teamObj = teams.find((t) => t.id === selectedTeamId);
    const headers = ['選手名', '日付', '種目', '値', '単位', '公式', 'メモ'];
    const rows = tableRows.map((r) => [
      r.name, r.date, testTypeName,
      r.value !== null ? String(r.value) : '',
      r.unit,
      r.is_official ? '公式' : '非公式',
      r.notes,
    ]);
    const csvLines = [
      `# パフォーマンス記録 - ${testTypeName}`,
      `# 期間: ${startDate} ～ ${endDate}`,
      teamObj ? `# チーム: ${teamObj.name}` : '',
      '',
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `performance_${teamObj?.name || 'team'}_${startDate}_${endDate}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Toggle helpers ---
  const toggleAthlete = (id: string) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleAllAthletes = () => {
    setSelectedAthleteIds((prev) =>
      prev.length === athletes.length ? [] : athletes.map((a) => a.id)
    );
  };
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const isReadyToFetch = !!selectedTestTypeId && selectedAthleteIds.length > 0 && !!startDate && !!endDate;
  const missingStep = !selectedTeamId
    ? 'チームを選択してください'
    : athleteLoading
    ? ''
    : athletes.length === 0
    ? 'このチームに選手が登録されていません'
    : !selectedCategoryId
    ? 'カテゴリを選択してください'
    : !selectedTestTypeId
    ? '種目を選択してください'
    : '';

  return (
    <div className="space-y-5">

      {/* ── Filter Panel ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">フィルター</h3>
        </div>

        {/* Selectors row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Organization (admin only) */}
          {allowOrgFilter && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">組織</label>
              <select
                value={selectedOrgId}
                onChange={(e) => { setSelectedOrgId(e.target.value); setSelectedTeamId(''); }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">組織を選択</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {/* Team (admin only; staff has preset) */}
          {allowOrgFilter && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">チーム</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={!selectedOrgId}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">チームを選択</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">カテゴリ</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">カテゴリを選択</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>

          {/* Test type */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">種目</label>
            <select
              value={selectedTestTypeId}
              onChange={(e) => setSelectedTestTypeId(e.target.value)}
              disabled={!selectedCategoryId}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">種目を選択</option>
              {testTypes.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
            </select>
          </div>
        </div>

        {/* Period selector */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">期間</label>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodPreset(p)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  periodPreset === p
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-purple-400'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2 mt-1 sm:mt-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-gray-400">〜</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Athlete multi-select */}
        {athletes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">選手</label>
              <button
                onClick={toggleAllAthletes}
                className="text-xs text-purple-600 hover:text-purple-700 hover:underline"
              >
                {selectedAthleteIds.length === athletes.length ? '全解除' : '全選択'}
              </button>
              <span className="text-xs text-gray-400">
                ({selectedAthleteIds.length}/{athletes.length}名選択中)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {athletes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => toggleAthlete(a.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    selectedAthleteIds.includes(a.id)
                      ? 'text-white border-transparent'
                      : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-purple-400'
                  }`}
                  style={
                    selectedAthleteIds.includes(a.id)
                      ? { backgroundColor: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }
                      : {}
                  }
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Guidance ── */}
      {athleteLoading && selectedTeamId && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-2" />
          <span className="text-sm text-gray-400">選手を読み込み中...</span>
        </div>
      )}
      {!athleteLoading && missingStep && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
          {missingStep}
        </div>
      )}
      {fetchError && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
          データ取得エラー: {fetchError}
        </div>
      )}

      {/* ── Chart ── */}
      {isReadyToFetch && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
            {selectedTestType?.display_name} の推移
            {unit && <span className="font-normal text-gray-400 ml-1.5">({unit})</span>}
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
              選択した期間・条件にデータがありません
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  stroke="#9CA3AF"
                  label={{ value: unit, angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(value: any, athleteId: string) => [
                    `${value} ${unit}`,
                    athleteById[athleteId]?.name || athleteId,
                  ]}
                  labelFormatter={(label) => label}
                />
                <Legend
                  formatter={(athleteId) => athleteById[athleteId]?.name || athleteId}
                  wrapperStyle={{ paddingTop: 16, fontSize: 13 }}
                />
                {activeAthleteIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    stroke={ATHLETE_COLORS[i % ATHLETE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {isReadyToFetch && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              記録一覧
              {tableRows.length > 0 && (
                <span className="font-normal text-gray-400 ml-1.5">({tableRows.length}件)</span>
              )}
            </h3>
            <button
              onClick={handleExport}
              disabled={tableRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              CSVエクスポート
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : tableRows.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
              データがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {[
                      { key: 'name' as SortField, label: '選手名' },
                      { key: 'date' as SortField, label: '日付' },
                      { key: 'value' as SortField, label: `値 (${unit || '―'})` },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white select-none whitespace-nowrap"
                      >
                        {label} <SortIcon field={key} />
                      </th>
                    ))}
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">公式</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {row.value !== null ? `${row.value} ${row.unit}` : '―'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex px-1.5 py-0.5 text-xs rounded font-medium ${
                            row.is_official
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {row.is_official ? '公式' : '非公式'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">
                        {row.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
