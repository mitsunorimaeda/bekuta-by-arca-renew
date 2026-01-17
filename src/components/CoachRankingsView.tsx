// src/components/CoachRankingsView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Team } from '../lib/supabase';
import { Trophy, RefreshCw, ChevronDown } from 'lucide-react';

type MetricKey = 'primary_value' | 'relative_1rm';

type TestType = {
  id: string;
  name: string;
  display_name: string;
  unit: string;
  higher_is_better: boolean | null;
  category_id: string;

  sort_order?: number | null;
  is_active?: boolean | null;
  user_can_input?: boolean | null;

  category_label?: string;
  category_sort?: number | null;
};

type RankingRow = {
  user_id: string;
  name: string | null;
  date: string | null; // YYYY-MM-DD
  value: number | null;
  rank: number | null;
  top_percent: number | null;
  team_n: number | null;
};

type Props = {
  team: Team;
  onOpenAthlete?: (userId: string, testTypeId: string, metric: MetricKey) => void;
};

const strengthTestNames = new Set([
  'bench_press',
  'back_squat',
  'deadlift',
  'bulgarian_squat_r',
  'bulgarian_squat_l',
]);

// ✅ 表示桁を「単位」で決める
const digitsForByUnit = (unit?: string) => {
  const u = (unit || '').trim();

  // 整数にしたい単位
  const intUnits = new Set(['回', '点', 'm']); // 必要なら '本' '枚' など追加
  if (intUnits.has(u)) return 0;

  // それ以外は基本2桁
  return 2;
};

// カテゴリ順（表示の好み）
const CATEGORY_ORDER = ['筋力', 'スプリント', 'ジャンプ', '敏捷', '持久', 'その他'];

/**
 * ✅ ランキング方向
 * - DBの higher_is_better が false なら「小さいほど良い」
 * - それ以外でも「スプリント」「敏捷」は小さいほど良い（要望）
 *
 * ※ 今回はDB側で team_rank を返している前提なので、
 *    lowerIsBetter は「説明文表示」用途のみ（並び替えはしない）
 */
const isLowerBetterByRule = (t: TestType | null) => {
  if (!t) return false;

  if (t.higher_is_better === false) return true;
  if (t.higher_is_better === true) return false;

  const cat = t.category_label || '';
  if (cat === 'スプリント' || cat === '敏捷') return true;

  const name = (t.name || '').toLowerCase();
  const timeLike =
    name.startsWith('sprint_') ||
    name === '050_r' ||
    name === '050_l' ||
    name === '050-l' ||
    name.startsWith('pro_agility') ||
    name.startsWith('arrowhead');

  return timeLike;
};

// ✅ 「ランキングがどこ参照か」をラベル化（DBが返す benchmark_scope を想定）
const scopeLabel = (scope: string | null) => {
  if (scope === 'team') return 'チーム内';
  if (scope === 'org_sport') return '同校×同競技';
  if (scope === 'sport') return '競技全体';
  return '不明';
};

export function CoachRankingsView({ team, onOpenAthlete }: Props) {
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [loadingTestTypes, setLoadingTestTypes] = useState(false);
  const [testTypesError, setTestTypesError] = useState<string | null>(null);

  const [selectedTestTypeId, setSelectedTestTypeId] = useState<string>('');
  const selectedTestType = useMemo(
    () => testTypes.find((t) => t.id === selectedTestTypeId) ?? null,
    [testTypes, selectedTestTypeId]
  );

  const [metric, setMetric] = useState<MetricKey>('primary_value');
  const isStrength = !!selectedTestType && strengthTestNames.has(selectedTestType.name);

  const unitLabel = useMemo(() => {
    if (!selectedTestType) return '';
    if (isStrength && metric === 'relative_1rm') return '×BW';
    return selectedTestType.unit || '';
  }, [selectedTestType, isStrength, metric]);

  const lowerIsBetter = useMemo(() => isLowerBetterByRule(selectedTestType), [selectedTestType]);

  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  // ✅ 参照スコープ表示用（DBが返す meta を拾う）
  const [benchmarkScope, setBenchmarkScope] = useState<string | null>(null);
  const [benchmarkN, setBenchmarkN] = useState<number | null>(null);
  const [minN, setMinN] = useState<number | null>(null);

  // RPC死んでても画面が出るようにダミー
  const dummyRanking: RankingRow[] = useMemo(
    () => [
      { user_id: 'dummy1', name: '田中', date: '2026-01-10', value: 73.3, rank: 1, top_percent: 0, team_n: 12 },
      { user_id: 'dummy2', name: '佐藤', date: '2026-01-08', value: 71.2, rank: 2, top_percent: 8.3, team_n: 12 },
      { user_id: 'dummy3', name: '鈴木', date: '2026-01-05', value: 69.0, rank: 3, top_percent: 16.7, team_n: 12 },
    ],
    []
  );

  // ----------------------------
  // 種目一覧：カテゴリでoptgroup化
  // ----------------------------
  const grouped = useMemo(() => {
    const map = new Map<string, TestType[]>();

    for (const t of testTypes) {
      const key = t.category_label || 'その他';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const sa = a.sort_order ?? 9999;
        const sb = b.sort_order ?? 9999;
        if (sa !== sb) return sa - sb;
        return (a.display_name || '').localeCompare(b.display_name || '', 'ja');
      });
      map.set(k, arr);
    }

    return Array.from(map.entries()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]);
      const bi = CATEGORY_ORDER.indexOf(b[0]);
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a[0].localeCompare(b[0], 'ja');
    });
  }, [testTypes]);

  // ----------------------------
  // 1) テスト種目一覧 取得
  // ----------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingTestTypes(true);
        setTestTypesError(null);

        const { data, error } = await supabase
          .from('performance_test_types')
          .select(
            `
              id,
              name,
              display_name,
              unit,
              higher_is_better,
              category_id,
              sort_order,
              is_active,
              user_can_input,
              performance_categories (
                id,
                name,
                display_name,
                sort_order
              )
            `
          )
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        const rows = (data ?? []) as any[];
        const types: TestType[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          display_name: r.display_name,
          unit: r.unit,
          higher_is_better: r.higher_is_better,
          category_id: r.category_id,
          sort_order: r.sort_order ?? null,
          is_active: r.is_active,
          user_can_input: r.user_can_input,
          category_label:
            r.performance_categories?.display_name || r.performance_categories?.name || 'その他',
          category_sort: r.performance_categories?.sort_order ?? 999,
        }));

        if (cancelled) return;

        setTestTypes(types);

        // 初期選択
        if (!selectedTestTypeId && types.length > 0) {
          setSelectedTestTypeId(types[0].id);
        }
      } catch (e: any) {
        console.warn('[CoachRankingsView] testTypes error', e);
        if (!cancelled) setTestTypesError(e?.message ?? '種目の取得に失敗しました');
      } finally {
        if (!cancelled) setLoadingTestTypes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  // 種目が変わったら、筋力以外は metric を primary に戻す
  useEffect(() => {
    if (!selectedTestType) return;
    if (!strengthTestNames.has(selectedTestType.name)) setMetric('primary_value');
  }, [selectedTestType?.id]);

  // ----------------------------
  // 2) ランキング取得（RPC：get_team_test_ranking）
  // ----------------------------
  const fetchRanking = async () => {
    if (!team?.id || !selectedTestTypeId) return;

    try {
      setLoadingRanking(true);
      setRankingError(null);

      const { data, error } = await supabase.rpc('get_team_test_ranking', {
        p_days: 365,
        p_limit: 50,
        p_metric: metric,
        p_team_id: team.id,
        p_test_type_id: selectedTestTypeId,
      });

      if (error) throw error;

      const rows = (data ?? []) as any[];

      // ✅ 参照スコープを表示するためのメタ情報（DBが返す想定）
      const meta = rows?.[0] ?? null;
      setBenchmarkScope(meta?.benchmark_scope ?? null);
      setBenchmarkN(meta?.benchmark_n != null ? Number(meta.benchmark_n) : null);
      setMinN(meta?.min_n != null ? Number(meta.min_n) : null);

      const mapped: RankingRow[] = rows.map((r) => ({
        user_id: r.user_id,
        name: r.name ?? null,
        date: r.latest_date ?? null,
        value: r.latest_value != null ? Number(r.latest_value) : null,
        rank: r.team_rank != null ? Number(r.team_rank) : null,
        top_percent: r.top_percent != null ? Number(r.top_percent) : null,
        team_n: r.team_n != null ? Number(r.team_n) : null,
      }));

      setRanking(mapped);
    } catch (e: any) {
      console.warn('[CoachRankingsView] ranking error', e);
      setRankingError(e?.message ?? 'ランキング取得に失敗しました');
      setRanking(dummyRanking);

      // ✅ フォールバック時は参照スコープ表示は出さない
      setBenchmarkScope(null);
      setBenchmarkN(null);
      setMinN(null);
    } finally {
      setLoadingRanking(false);
    }
  };

  useEffect(() => {
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, selectedTestTypeId, metric]);

  const displayName = (r: RankingRow) => r.name || '名前未設定';

  const fmtValue = (v: number | null) => {
    if (v == null) return '-';

    const d = digitsForByUnit(unitLabel); // ← unitLabel を使うのがポイント
    const n = Number(v);

    // d=0 のときは 73.0 みたいなブレをなくす
    if (d === 0) return String(Math.round(n));

    return n.toFixed(d);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div className="text-base sm:text-lg font-semibold text-gray-900">ランキング</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              種目ごとに「最新測定」の値で順位付け（チーム内）／
              {lowerIsBetter ? '小さいほど上位' : '大きいほど上位'}
            </div>
          </div>

          <button
            onClick={fetchRanking}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            title="再取得"
          >
            <RefreshCw className={`w-4 h-4 ${loadingRanking ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {/* 種目セレクタ */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <select
              value={selectedTestTypeId}
              onChange={(e) => setSelectedTestTypeId(e.target.value)}
              className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white"
              disabled={loadingTestTypes}
            >
              {grouped.map(([label, items]) => (
                <optgroup key={label} label={label}>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 筋力のみ metric 切替 */}
          <div className="flex items-center justify-between">
            {isStrength ? (
              <div className="inline-flex rounded-lg bg-gray-100 p-1 text-[12px]">
                <button
                  type="button"
                  onClick={() => setMetric('primary_value')}
                  className={`px-3 py-1.5 rounded-md ${
                    metric === 'primary_value' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  推定1RM
                </button>
                <button
                  type="button"
                  onClick={() => setMetric('relative_1rm')}
                  className={`px-3 py-1.5 rounded-md ${
                    metric === 'relative_1rm' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  相対1RM
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500">（筋力以外は自動）</div>
            )}

            <div className="text-sm text-gray-700">
              単位：<span className="font-semibold">{unitLabel || '-'}</span>
            </div>
          </div>
        </div>

        {testTypesError && <div className="mt-3 text-sm text-red-600">{testTypesError}</div>}
      </div>

      {/* ランキング表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            {selectedTestType?.display_name ?? '種目'} の順位
          </div>

          {/* ✅ 参照スコープ表示（DBが返す時だけ表示） */}
          <div className="text-xs text-gray-500">
            {benchmarkScope ? (
              <>
                比較：{scopeLabel(benchmarkScope)}
                {typeof benchmarkN === 'number' ? `（n=${benchmarkN}）` : ''}
                {typeof minN === 'number' ? ` / 閾値=${minN}` : ''}
              </>
            ) : ranking?.[0]?.team_n ? (
              `n=${ranking[0].team_n}`
            ) : (
              ''
            )}
          </div>
        </div>

        {/* ✅ 自動拡張をしている場合の注意（任意だけど親切） */}
        {benchmarkScope && benchmarkScope !== 'team' && (
          <div className="px-4 sm:px-5 py-2 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100">
            ※チーム内の母集団が少ないため、比較母集団を自動で拡張しています
          </div>
        )}

        {rankingError && (
          <div className="px-4 sm:px-5 py-3 text-sm text-amber-700 bg-amber-50 border-b border-amber-100">
            {rankingError}
            <span className="ml-2 text-xs text-amber-600">（RPC未整備ならダミー表示になります）</span>
          </div>
        )}

        {loadingRanking ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : ranking.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            データがありません（この種目の測定がまだ無い可能性）
          </div>
        ) : (
          <div className="divide-y">
            {ranking.map((r) => (
              <button
                key={`${r.user_id}-${r.rank ?? 'x'}`}
                className="w-full text-left px-4 sm:px-5 py-3 hover:bg-gray-50"
                onClick={() => {
                  if (onOpenAthlete) onOpenAthlete(r.user_id, selectedTestTypeId, metric);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-base font-bold text-gray-900 w-10">{r.rank ?? '-'}位</div>
                      <div className="font-semibold text-gray-900 truncate">{displayName(r)}</div>
                      {typeof r.top_percent === 'number' && (
                        <span className="text-[11px] px-2 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                          上位 {Number(r.top_percent).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-gray-600">最終測定日：{r.date ?? '-'}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">
                      {fmtValue(r.value)}
                      <span className="text-sm font-semibold text-gray-600 ml-1">{unitLabel}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">※ 仕様：各選手の「最新記録」で順位付け（同値は rank() で同順位）</div>
    </div>
  );
}

export default CoachRankingsView;