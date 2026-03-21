import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel } from '../../lib/rehabConstants';
import {
  Stethoscope, Activity, AlertCircle, CheckCircle, ChevronRight,
  Plus, Calendar, TrendingUp
} from 'lucide-react';

interface Injury {
  id: string;
  diagnosis: string;
  body_part_key: string | null;
  injury_site: string | null;
  injury_date: string | null;
  status: string;
}

interface Prescription {
  id: string;
  title: string;
  current_phase: number;
  status: string;
  injury_id: string | null;
  created_at: string;
}

interface DailyLog {
  log_date: string;
  pain_level: number;
}

interface AthleteRehabTabProps {
  athleteId: string;
  onOpenAssign: (athleteId: string, injuryId?: string) => void;
  onOpenEvaluation?: (injuryId: string, bodyPartKey: string, currentPhase: number) => void;
  onOpenPrescription?: (prescriptionId: string, athleteId: string) => void;
}

export default function AthleteRehabTab({ athleteId, onOpenAssign, onOpenEvaluation, onOpenPrescription }: AthleteRehabTabProps) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [athleteId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 怪我一覧
      const { data: injData } = await supabase
        .schema('rehab')
        .from('injuries')
        .select('id, diagnosis, body_part_key, injury_site, injury_date, status')
        .eq('athlete_user_id', athleteId)
        .in('status', ['active', 'conditioning'])
        .order('created_at', { ascending: false });

      setInjuries(injData || []);

      // アクティブな処方
      const { data: presData } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('id, title, current_phase, status, injury_id, created_at')
        .eq('athlete_user_id', athleteId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setPrescriptions(presData || []);

      // 直近14日のNRS推移
      const { data: logData } = await supabase
        .schema('rehab')
        .from('prescription_daily_logs')
        .select('log_date, pain_level')
        .eq('athlete_user_id', athleteId)
        .order('log_date', { ascending: false })
        .limit(14);

      setRecentLogs((logData || []).reverse());
    } catch (e) {
      console.error('[AthleteRehabTab]', e);
    } finally {
      setLoading(false);
    }
  };

  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil(Math.abs(new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 怪我一覧 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Stethoscope size={16} className="text-red-500" /> 怪我一覧
        </h3>
        {injuries.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            アクティブな怪我はありません
          </div>
        ) : (
          <div className="space-y-2">
            {injuries.map(inj => {
              const prescription = prescriptions.find(p => p.injury_id === inj.id);
              return (
                <div key={inj.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{inj.diagnosis}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          inj.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          {inj.status === 'active' ? 'Active' : 'Conditioning'}
                        </span>
                        {inj.body_part_key && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {getBodyPartLabel(inj.body_part_key)}
                          </span>
                        )}
                        {inj.injury_date && (
                          <span className="text-xs text-gray-400">
                            {getDaysSince(inj.injury_date)}日経過
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {onOpenEvaluation && inj.body_part_key && prescription && (
                        <button
                          onClick={() => onOpenEvaluation(inj.id, inj.body_part_key!, prescription.current_phase)}
                          className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 font-medium"
                        >
                          評価記録
                        </button>
                      )}
                      <button
                        onClick={() => onOpenAssign(athleteId, inj.id)}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium flex items-center gap-1"
                      >
                        <Plus size={12} /> 処方作成
                      </button>
                    </div>
                  </div>

                  {/* この怪我の処方 */}
                  {prescription && (
                    <div
                      onClick={() => onOpenPrescription?.(prescription.id, athleteId)}
                      className="mt-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{prescription.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Phase {prescription.current_phase} 進行中
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded font-medium">
                          Phase {prescription.current_phase}
                        </span>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NRS推移（直近14日） */}
      {recentLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" /> NRS推移（直近14日）
          </h3>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-end gap-1 h-20">
              {recentLogs.map((log, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${log.pain_level >= 4 ? 'bg-red-400' : log.pain_level >= 2 ? 'bg-orange-300' : 'bg-blue-300'}`}
                    style={{ height: `${Math.max(log.pain_level * 10, 4)}%` }}
                    title={`${log.log_date}: NRS ${log.pain_level}`}
                  />
                  <span className="text-[9px] text-gray-400">{log.log_date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 怪我に紐づかない処方 */}
      {prescriptions.filter(p => !p.injury_id).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-green-500" /> その他のリハビリプログラム
          </h3>
          <div className="space-y-2">
            {prescriptions.filter(p => !p.injury_id).map(pres => (
              <div key={pres.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{pres.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Phase {pres.current_phase}</div>
                </div>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded font-medium">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
