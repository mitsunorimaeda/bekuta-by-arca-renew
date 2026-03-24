import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel } from '../../lib/rehabConstants';
import {
  Stethoscope, Zap, Activity, Users, Search,
  ChevronRight, AlertTriangle, CheckCircle, Filter,
  Plus, ArrowLeft, Archive
} from 'lucide-react';
// removed duplicate import

type PurposeFilter = 'all' | 'rehab' | 'performance' | 'conditioning';

interface AthleteProgram {
  athleteId: string;
  athleteName: string;
  // Injury info (null for performance/conditioning)
  injuryId: string | null;
  diagnosis: string | null;
  bodyPartKey: string | null;
  side: string | null;
  injuryStatus: string | null;
  injuryDate: string | null;
  // Prescription info
  prescriptionId: string;
  prescriptionTitle: string;
  purpose: string;
  currentPhase: number;
  phaseDetails: any;
  prescriptionStatus: string;
  // Latest log
  latestLogDate: string | null;
  latestPainLevel: number | null;
}

interface ProgramDashboardProps {
  teamId: string;
  teamName: string;
  onOpenKarte: (athleteId: string, injuryId?: string) => void;
  onCreateProgram: (athleteId?: string) => void;
  onBack: () => void;
}

const PURPOSE_CONFIG = {
  rehab: { label: 'リハビリ', icon: Stethoscope, color: 'red', bgLight: 'bg-red-50 dark:bg-red-900/10', textColor: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  performance: { label: 'パフォーマンス', icon: Zap, color: 'blue', bgLight: 'bg-blue-50 dark:bg-blue-900/10', textColor: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  conditioning: { label: 'コンディショニング', icon: Activity, color: 'green', bgLight: 'bg-green-50 dark:bg-green-900/10', textColor: 'text-green-600 dark:text-green-400', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
};

export function ProgramDashboard({ teamId, teamName, onOpenKarte, onCreateProgram, onBack }: ProgramDashboardProps) {
  const [programs, setPrograms] = useState<AthleteProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PurposeFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPrograms();
  }, [teamId]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);

      // Get team athletes (same view as StaffView athlete list)
      const { data: teamMembers } = await supabase
        .from('staff_team_athletes_with_activity' as any)
        .select('*')
        .eq('team_id', teamId);

      if (!teamMembers || teamMembers.length === 0) {
        setPrograms([]);
        return;
      }

      const athleteIds = teamMembers.map((m: any) => m.id);
      const athleteMap = new Map(teamMembers.map((m: any) => [m.id, m.name || '不明']));

      // Get active prescriptions
      const { data: prescriptions } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('id, athlete_user_id, title, purpose, current_phase, phase_details, status, injury_id')
        .in('athlete_user_id', athleteIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!prescriptions || prescriptions.length === 0) {
        setPrograms([]);
        return;
      }

      // Get injuries for rehab prescriptions
      const injuryIds = prescriptions.filter(p => p.injury_id).map(p => p.injury_id!);
      let injuryMap = new Map<string, any>();

      if (injuryIds.length > 0) {
        const { data: injuries } = await supabase
          .schema('rehab')
          .from('injuries')
          .select('id, diagnosis, body_part_key, side, status, injury_date')
          .in('id', injuryIds);

        if (injuries) {
          injuryMap = new Map(injuries.map(i => [i.id, i]));
        }
      }

      // Get latest logs
      const prescriptionIds = prescriptions.map(p => p.id);
      const { data: logs } = await supabase
        .schema('rehab')
        .from('prescription_daily_logs')
        .select('prescription_id, log_date, pain_level')
        .in('prescription_id', prescriptionIds)
        .order('log_date', { ascending: false });

      const logMap = new Map<string, { date: string; pain: number }>();
      if (logs) {
        for (const log of logs) {
          if (!logMap.has(log.prescription_id)) {
            logMap.set(log.prescription_id, { date: log.log_date, pain: log.pain_level });
          }
        }
      }

      // Build program list
      const result: AthleteProgram[] = prescriptions.map(p => {
        const injury = p.injury_id ? injuryMap.get(p.injury_id) : null;
        const latestLog = logMap.get(p.id);

        return {
          athleteId: p.athlete_user_id,
          athleteName: athleteMap.get(p.athlete_user_id) || '不明',
          injuryId: p.injury_id,
          diagnosis: injury?.diagnosis || null,
          bodyPartKey: injury?.body_part_key || null,
          side: injury?.side || null,
          injuryStatus: injury?.status || null,
          injuryDate: injury?.injury_date || null,
          prescriptionId: p.id,
          prescriptionTitle: p.title,
          purpose: p.purpose,
          currentPhase: p.current_phase,
          phaseDetails: p.phase_details,
          prescriptionStatus: p.status,
          latestLogDate: latestLog?.date || null,
          latestPainLevel: latestLog?.pain ?? null,
        };
      });

      setPrograms(result);
    } catch (e) {
      console.error('[ProgramDashboard]', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered & searched programs
  const filteredPrograms = useMemo(() => {
    return programs.filter(p => {
      if (filter !== 'all' && p.purpose !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.athleteName.toLowerCase().includes(q) ||
          (p.diagnosis && p.diagnosis.toLowerCase().includes(q)) ||
          p.prescriptionTitle.toLowerCase().includes(q);
      }
      return true;
    });
  }, [programs, filter, search]);

  // Summary counts
  const counts = useMemo(() => ({
    rehab: programs.filter(p => p.purpose === 'rehab').length,
    performance: programs.filter(p => p.purpose === 'performance').length,
    conditioning: programs.filter(p => p.purpose === 'conditioning').length,
    total: programs.length,
  }), [programs]);

  // Group by phase for rehab
  const groupedByPhase = useMemo(() => {
    if (filter !== 'rehab') return null;
    const groups = new Map<number, AthleteProgram[]>();
    filteredPrograms.forEach(p => {
      const phase = p.currentPhase;
      if (!groups.has(phase)) groups.set(phase, []);
      groups.get(phase)!.push(p);
    });
    return new Map([...groups].sort(([a], [b]) => a - b));
  }, [filteredPrograms, filter]);

  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil(Math.abs(new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSideLabel = (side: string | null) => {
    if (!side) return '';
    return side === 'left' ? '左' : side === 'right' ? '右' : '両側';
  };

  const handleArchive = async (prescriptionId: string) => {
    if (!window.confirm('このプログラムをアーカイブしますか？（復元可能）')) return;
    try {
      const { error } = await supabase.schema('rehab').from('prescriptions')
        .update({ status: 'archived' })
        .eq('id', prescriptionId);
      if (error) {
        console.error('[Archive] DB error:', error);
        alert(`アーカイブに失敗しました: ${error.message}`);
        return;
      }
      setPrograms(prev => prev.filter(p => p.prescriptionId !== prescriptionId));
    } catch (e: any) {
      console.error('[Archive]', e);
      alert(`アーカイブに失敗しました: ${e.message || '不明なエラー'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">プログラム管理</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{teamName}</p>
          </div>
        </div>
        <button
          onClick={() => onCreateProgram()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> 新規作成
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'all' as const, label: '全体', count: counts.total, color: 'gray' },
          { key: 'rehab' as const, label: 'リハビリ', count: counts.rehab, color: 'red' },
          { key: 'performance' as const, label: 'パフォ', count: counts.performance, color: 'blue' },
          { key: 'conditioning' as const, label: 'コンディ', count: counts.conditioning, color: 'green' },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`p-3 rounded-xl text-center transition-all ${
              filter === key
                ? `bg-${color}-100 dark:bg-${color}-900/30 ring-2 ring-${color}-500`
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className={`text-xl font-extrabold ${filter === key ? `text-${color}-600 dark:text-${color}-400` : 'text-gray-900 dark:text-white'}`}>
              {count}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="選手名・診断名で検索..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Program List */}
      {filteredPrograms.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <Users size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'アクティブなプログラムはありません' : `${PURPOSE_CONFIG[filter as keyof typeof PURPOSE_CONFIG]?.label || ''}のプログラムはありません`}
          </p>
          <button
            onClick={() => onCreateProgram()}
            className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            プログラムを作成する →
          </button>
        </div>
      ) : filter === 'rehab' && groupedByPhase ? (
        // Rehab: grouped by phase
        <div className="space-y-4">
          {[...groupedByPhase.entries()].map(([phase, items]) => (
            <div key={phase}>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-[10px] font-extrabold">
                  Phase {phase}
                </span>
                <span>{items.length}名</span>
              </h4>
              <div className="space-y-1.5">
                {items.map(p => (
                  <ProgramCard key={p.prescriptionId} program={p} onOpenKarte={onOpenKarte} onArchive={handleArchive} getDaysSince={getDaysSince} getSideLabel={getSideLabel} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // All / Performance / Conditioning: flat list
        <div className="space-y-1.5">
          {filteredPrograms.map(p => (
            <ProgramCard key={p.prescriptionId} program={p} onOpenKarte={onOpenKarte} getDaysSince={getDaysSince} getSideLabel={getSideLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

// Program Card Component with swipe-to-archive
function ProgramCard({
  program,
  onOpenKarte,
  onArchive,
  getDaysSince,
  getSideLabel,
}: {
  program: AthleteProgram;
  onOpenKarte: (athleteId: string, injuryId?: string) => void;
  onArchive: (prescriptionId: string) => void;
  getDaysSince: (d: string | null) => number | null;
  getSideLabel: (s: string | null) => string;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const config = PURPOSE_CONFIG[program.purpose as keyof typeof PURPOSE_CONFIG] || PURPOSE_CONFIG.rehab;
  const Icon = config.icon;
  const maxPhase = program.phaseDetails ? (typeof program.phaseDetails === 'object' ? Object.keys(program.phaseDetails).length : 1) : 1;
  const progress = maxPhase > 0 ? (program.currentPhase / maxPhase) * 100 : 0;
  const daysSince = getDaysSince(program.injuryDate);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    const diff = startX - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, 80));
    else setSwipeX(0);
  };
  const handleTouchEnd = () => {
    if (swipeX > 50) setShowArchive(true);
    else { setShowArchive(false); setSwipeX(0); }
    setStartX(null);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Archive button (behind the card) */}
      <div className="absolute inset-y-0 right-0 w-20 bg-amber-500 flex items-center justify-center rounded-r-xl">
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(program.prescriptionId); }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Archive size={18} />
          <span className="text-[10px] font-bold">アーカイブ</span>
        </button>
      </div>

      {/* Main card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!showArchive) onOpenKarte(program.athleteId, program.injuryId || undefined); }}
        className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all group cursor-pointer"
        style={{ transform: `translateX(-${showArchive ? 80 : swipeX}px)`, transition: startX !== null ? 'none' : 'transform 0.2s ease' }}
      >
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bgLight}`}>
          <Icon size={18} className={config.textColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{program.athleteName}</span>
            {program.latestPainLevel != null && program.purpose === 'rehab' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                program.latestPainLevel >= 7 ? 'bg-red-100 text-red-600' :
                program.latestPainLevel >= 4 ? 'bg-orange-100 text-orange-600' :
                'bg-green-100 text-green-600'
              }`}>
                NRS {program.latestPainLevel}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {program.diagnosis ? (
              <>{getSideLabel(program.side)}{program.diagnosis} · {daysSince}日</>
            ) : (
              program.prescriptionTitle
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  program.purpose === 'rehab' ? 'bg-red-500' :
                  program.purpose === 'performance' ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-gray-400">P{program.currentPhase}/{maxPhase}</span>
          </div>
        </div>

        {/* PC: hover archive button + Arrow */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(program.prescriptionId); }}
            className="hidden sm:group-hover:flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            title="アーカイブ"
          >
            <Archive size={14} />
          </button>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}

export default ProgramDashboard;
