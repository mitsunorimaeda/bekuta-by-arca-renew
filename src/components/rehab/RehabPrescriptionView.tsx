import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel } from '../../lib/rehabConstants';
import {
  ArrowLeft, Activity, Heart, Zap, Brain, Coffee,
  ChevronLeft, ChevronRight, Calendar, Stethoscope, Edit2
} from 'lucide-react';

interface PrescriptionItem {
  id: string;
  name: string;
  quantity: string;
  sets: string;
  phase: number;
  icon_type: string;
  video_url: string | null;
}

interface RehabPrescriptionViewProps {
  prescriptionId: string;
  athleteId: string;
  onBack: () => void;
  onEdit?: (prescriptionId: string, athleteId: string) => void;
}

export default function RehabPrescriptionView({ prescriptionId, athleteId, onBack, onEdit }: RehabPrescriptionViewProps) {
  const [prescription, setPrescription] = useState<any>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [injury, setInjury] = useState<any>(null);
  const [athlete, setAthlete] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(1);

  useEffect(() => {
    fetchData();
  }, [prescriptionId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 処方
      const { data: presData } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single();

      // アイテムを別クエリで取得（cross-schema join回避）
      const { data: itemsData } = await supabase
        .schema('rehab')
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', prescriptionId)
        .order('phase', { ascending: true })
        .order('item_index', { ascending: true });

      if (presData) {
        setPrescription(presData);
        setItems(itemsData || []);
        setActivePhase(presData.current_phase || 1);

        // 怪我情報
        if (presData.injury_id) {
          const { data: injData } = await supabase
            .schema('rehab')
            .from('injuries')
            .select('diagnosis, body_part_key, injury_site, injury_date, status')
            .eq('id', presData.injury_id)
            .single();
          setInjury(injData);
        }
      }

      // 選手名
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', athleteId)
        .single();
      setAthlete(userData);

      // 直近のログ（選手の全処方のログを表示）
      const { data: logData } = await supabase
        .schema('rehab')
        .from('prescription_daily_logs')
        .select('log_date, pain_level, item_results')
        .eq('athlete_user_id', athleteId)
        .order('log_date', { ascending: false })
        .limit(14);
      setLogs((logData || []).reverse());

    } catch (e) {
      console.error('[RehabPrescriptionView]', e);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'care': return <Heart size={18} className="text-green-500" />;
      case 'cardio': return <Zap size={18} className="text-blue-500" />;
      case 'mental': return <Brain size={18} className="text-purple-500" />;
      case 'life': return <Coffee size={18} className="text-yellow-500" />;
      default: return <Activity size={18} className="text-red-500" />;
    }
  };

  // フェーズ一覧を導出
  const phaseNumbers = [...new Set(items.map(i => i.phase))].sort((a, b) => a - b);
  const currentPhaseItems = items.filter(i => i.phase === activePhase);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        処方が見つかりませんでした
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{athlete?.name || '選手'} さんの処方</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{prescription.title}</h2>
            {prescription.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{prescription.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                prescription.purpose === 'performance' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : prescription.purpose === 'conditioning' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {prescription.purpose === 'performance' ? 'パフォーマンス' : prescription.purpose === 'conditioning' ? 'コンディショニング' : 'リハビリ'}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded font-medium">
                Phase {prescription.current_phase}
              </span>
              {injury && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded font-medium">
                  {injury.diagnosis}
                </span>
              )}
              {prescription.start_date && (
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded flex items-center gap-1">
                  <Calendar size={12} /> {prescription.start_date}〜
                </span>
              )}
            </div>
          </div>
          {onEdit && (
            <button
              onClick={() => onEdit(prescriptionId, athleteId)}
              className="flex items-center gap-1 text-xs px-3 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium"
            >
              <Edit2 size={14} /> 編集
            </button>
          )}
        </div>
      </div>

      {/* フェーズタブ */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {phaseNumbers.map(phase => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activePhase === phase
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Phase {phase}
            <span className="ml-1 text-xs opacity-70">({items.filter(i => i.phase === phase).length})</span>
          </button>
        ))}
      </div>

      {/* エクササイズ一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Phase {activePhase} のメニュー</h3>
          {prescription.phase_details?.[activePhase]?.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{prescription.phase_details[activePhase].description}</p>
          )}
          {prescription.phase_details?.[activePhase]?.boss && (
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
              移行条件: {prescription.phase_details[activePhase].boss}
            </div>
          )}
        </div>
        {currentPhaseItems.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            このフェーズにはメニューがありません
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {currentPhaseItems.sort((a, b) => (a as any).item_index - (b as any).item_index).map(item => (
              <div key={item.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  {getIcon(item.icon_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</div>
                  {(item as any).input_type === 'weight' ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                      {(item as any).intensity && <span>{(item as any).intensity}</span>}
                      {(item as any).rep_range && <span>({(item as any).rep_range}rep)</span>}
                      {(item as any).target_rpe && <span>RPE {(item as any).target_rpe}</span>}
                      {(item as any).tempo && <span>T:{(item as any).tempo}</span>}
                      {item.sets && <span>{item.sets}</span>}
                      {(item as any).rest_seconds && <span>REST{(item as any).rest_seconds}s</span>}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.quantity} × {item.sets}
                    </div>
                  )}
                  {(item as any).sub_exercise && (
                    <div className="text-[10px] text-blue-500 mt-0.5">REST中: {(item as any).sub_exercise}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NRS/RPE推移 */}
      {logs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">
            {prescription.purpose === 'rehab' || !prescription.purpose ? 'NRS推移（直近14日）' : 'RPE推移（直近14日）'}
          </h3>
          <div className="flex items-end gap-1 h-24">
            {logs.map((log, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-400 font-medium">{log.pain_level}</div>
                <div
                  className={`w-full rounded-t ${log.pain_level >= 4 ? 'bg-red-400' : log.pain_level >= 2 ? 'bg-orange-300' : 'bg-blue-300'}`}
                  style={{ height: `${Math.max(log.pain_level * 10, 4)}%` }}
                />
                <span className="text-[9px] text-gray-400">{log.log_date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
