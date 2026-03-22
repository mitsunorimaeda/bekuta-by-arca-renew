// src/hooks/useTeamPhase.ts
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { TeamPhaseRow } from '../types/athlete';

function addDaysToDateString(dateStr: string, addDays: number) {
  // dateStr: 'YYYY-MM-DD'（JST）を想定
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + addDays);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function useTeamPhase(teamId: string | null, today: string) {
  const [todayPhase, setTodayPhase] = useState<TeamPhaseRow | null>(null);
  const [nextPhases, setNextPhases] = useState<TeamPhaseRow[]>([]);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const isPhaseEmpty = !phaseLoading && !phaseError && !todayPhase;

  useEffect(() => {
    if (!teamId) {
      // team_id が無いユーザーは表示できない（staffなど）
      setTodayPhase(null);
      setNextPhases([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPhaseLoading(true);
      setPhaseError(null);

      try {
        // 今日のフェーズ
        const { data: d1, error: e1 } = await supabase.rpc('get_team_phase_on_date', {
          p_team_id: teamId,
          p_date: today,
        });

        if (e1) throw e1;

        // 3週間レンジ（今日〜21日後）
        const end = addDaysToDateString(today, 21);
        const { data: d2, error: e2 } = await supabase.rpc('get_team_phases_in_range', {
          p_team_id: teamId,
          p_start: today,
          p_end: end,
        });

        if (e2) throw e2;

        if (cancelled) return;

        const row1 = (Array.isArray(d1) ? d1[0] : d1) as TeamPhaseRow | null;
        setTodayPhase(row1 ?? null);

        const rows2 = (Array.isArray(d2) ? d2 : []) as TeamPhaseRow[];

        // ✅ 「今日」と同じフェーズは "今後" から除外
        const filtered = (rows2 ?? []).filter((p) => {
          if (!row1) return true;
          return !(
            p.phase_type === row1.phase_type &&
            p.start_date === row1.start_date &&
            p.end_date === row1.end_date
          );
        });

        // ✅ 念のため日付順に（関数側で並んでるなら不要だけど安全）
        filtered.sort((a, b) => (a.start_date > b.start_date ? 1 : a.start_date < b.start_date ? -1 : 0));

        setNextPhases(filtered);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[team phase fetch error]', err);
        setPhaseError(err?.message ?? 'team phase fetch error');
        setTodayPhase(null);
        setNextPhases([]);
      } finally {
        if (!cancelled) setPhaseLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [teamId, today]);

  const phaseLabel = useMemo(
    () => (t: TeamPhaseRow['phase_type']) => {
      switch (t) {
        case 'off': return 'オフ';
        case 'pre': return 'プレ';
        case 'in': return 'イン';
        case 'peak': return 'ピーク';
        case 'transition': return '移行';
        default: return '未設定';
      }
    },
    []
  );

  const toShortRange = useMemo(
    () => (s: string, e: string) => {
      // s,e: YYYY-MM-DD
      const sm = Number(s.slice(5, 7));
      const sd = Number(s.slice(8, 10));
      const em = Number(e.slice(5, 7));
      const ed = Number(e.slice(8, 10));
      if (!sm || !sd || !em || !ed) return `${s}〜${e}`;
      return `${sm}/${sd}–${em}/${ed}`;
    },
    []
  );

  return {
    todayPhase,
    nextPhases,
    phaseLoading,
    phaseError,
    isPhaseEmpty,
    phaseLabel,
    toShortRange,
  };
}
