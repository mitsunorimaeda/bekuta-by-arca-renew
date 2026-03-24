import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel, BODY_PART_OPTIONS } from '../../lib/rehabConstants';
import {
  Stethoscope, Activity, Plus, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, X, AlertTriangle, Save, MapPin, Calendar as CalendarIcon
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
  purpose: string;
  created_at: string;
  phase_details: any;
}

interface DailyLog {
  log_date: string;
  pain_level: number;
}

interface AthleteRehabTabProps {
  athleteId: string;
  onOpenAssign: (athleteId: string, injuryId?: string, purpose?: string) => void;
  onOpenEvaluation?: (injuryId: string, bodyPartKey: string, currentPhase: number) => void;
  onOpenPrescription?: (prescriptionId: string, athleteId: string) => void;
}

export default function AthleteRehabTab({ athleteId, onOpenAssign, onOpenEvaluation, onOpenPrescription }: AthleteRehabTabProps) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 怪我登録フォーム
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({
    diagnosis: '',
    body_part_key: '',
    injury_site: '',
    injury_date: new Date().toISOString().slice(0, 10),
  });
  const [injurySaving, setInjurySaving] = useState(false);

  // 展開された怪我カード
  const [expandedInjury, setExpandedInjury] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [injResult, presResult, logResult] = await Promise.all([
        supabase
          .schema('rehab')
          .from('injuries')
          .select('id, diagnosis, body_part_key, injury_site, injury_date, status')
          .eq('athlete_user_id', athleteId)
          .in('status', ['active', 'conditioning'])
          .order('created_at', { ascending: false }),
        supabase
          .schema('rehab')
          .from('prescriptions')
          .select('id, title, current_phase, status, injury_id, purpose, created_at, phase_details')
          .eq('athlete_user_id', athleteId)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .schema('rehab')
          .from('prescription_daily_logs')
          .select('log_date, pain_level')
          .eq('athlete_user_id', athleteId)
          .order('log_date', { ascending: false })
          .limit(14),
      ]);

      setInjuries(injResult.data || []);
      setPrescriptions(presResult.data || []);
      setRecentLogs((logResult.data || []).reverse());
    } catch (e) {
      console.error('[AthleteRehabTab]', e);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil(Math.abs(new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  // 怪我登録
  const handleSaveInjury = async () => {
    if (!injuryForm.diagnosis.trim() || !injuryForm.body_part_key) return;

    setInjurySaving(true);
    try {
      const { error } = await supabase
        .schema('rehab')
        .from('injuries')
        .insert({
          athlete_user_id: athleteId,
          diagnosis: injuryForm.diagnosis.trim(),
          body_part_key: injuryForm.body_part_key,
          injury_site: injuryForm.injury_site.trim() || null,
          injury_date: injuryForm.injury_date || null,
          status: 'active',
        });

      if (error) throw error;

      // リセット & リフレッシュ
      setInjuryForm({ diagnosis: '', body_part_key: '', injury_site: '', injury_date: new Date().toISOString().slice(0, 10) });
      setShowInjuryForm(false);
      await fetchData();
    } catch (e: any) {
      alert(e.message || '怪我の登録に失敗しました');
    } finally {
      setInjurySaving(false);
    }
  };

  // フェーズ進行/後退
  const handlePhaseChange = async (prescriptionId: string, currentPhase: number, direction: 'up' | 'down') => {
    const newPhase = direction === 'up' ? currentPhase + 1 : Math.max(1, currentPhase - 1);
    try {
      const { error } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .update({ current_phase: newPhase })
        .eq('id', prescriptionId);

      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      alert(e.message || 'フェーズ変更に失敗しました');
    }
  };

  // 怪我ステータス変更
  const handleInjuryStatusChange = async (injuryId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .schema('rehab')
        .from('injuries')
        .update({ status: newStatus })
        .eq('id', injuryId);

      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      alert(e.message || 'ステータス変更に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ========== 怪我一覧 ========== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Stethoscope size={16} className="text-red-500" /> 怪我一覧
            {injuries.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({injuries.length}件)</span>
            )}
          </h3>
          <button
            onClick={() => setShowInjuryForm(!showInjuryForm)}
            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              showInjuryForm
                ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
            }`}
          >
            {showInjuryForm ? <X size={12} /> : <Plus size={12} />}
            {showInjuryForm ? '閉じる' : '怪我を登録'}
          </button>
        </div>

        {/* ---- 怪我登録フォーム ---- */}
        {showInjuryForm && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 mb-3 space-y-3">
            <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={12} /> 新しい怪我を登録
            </h4>

            {/* 診断名 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">診断名 *</label>
              <input
                type="text"
                value={injuryForm.diagnosis}
                onChange={(e) => setInjuryForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                placeholder="例: 右膝前十字靭帯損傷"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* 部位 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <MapPin size={10} className="inline mr-1" />部位 *
              </label>
              <select
                value={injuryForm.body_part_key}
                onChange={(e) => setInjuryForm(prev => ({ ...prev, body_part_key: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">部位を選択...</option>
                {BODY_PART_OPTIONS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map(item => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* 受傷部位の詳細 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">受傷部位の詳細（任意）</label>
              <input
                type="text"
                value={injuryForm.injury_site}
                onChange={(e) => setInjuryForm(prev => ({ ...prev, injury_site: e.target.value }))}
                placeholder="例: 右膝内側"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* 受傷日 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <CalendarIcon size={10} className="inline mr-1" />受傷日
              </label>
              <input
                type="date"
                value={injuryForm.injury_date}
                onChange={(e) => setInjuryForm(prev => ({ ...prev, injury_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* 保存ボタン */}
            <button
              onClick={handleSaveInjury}
              disabled={injurySaving || !injuryForm.diagnosis.trim() || !injuryForm.body_part_key}
              className="w-full py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Save size={14} />
              {injurySaving ? '登録中...' : '怪我を登録 → 処方作成へ'}
            </button>
          </div>
        )}

        {/* ---- 怪我カード一覧 ---- */}
        {injuries.length === 0 && !showInjuryForm ? (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center">
            <Stethoscope size={24} className="mx-auto mb-2 text-gray-300 dark:text-gray-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">アクティブな怪我はありません</p>
            <button
              onClick={() => setShowInjuryForm(true)}
              className="mt-3 text-xs text-red-600 dark:text-red-400 font-medium hover:underline"
            >
              怪我を登録する →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {injuries.map(inj => {
              const prescription = prescriptions.find(p => p.injury_id === inj.id);
              const isExpanded = expandedInjury === inj.id;
              const daysSince = getDaysSince(inj.injury_date);
              const phaseDetails = prescription?.phase_details as any[] | undefined;
              const maxPhase = phaseDetails?.length || 1;

              return (
                <div key={inj.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* ヘッダー */}
                  <button
                    onClick={() => setExpandedInjury(isExpanded ? null : inj.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{inj.diagnosis}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          inj.status === 'active'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          {inj.status === 'active' ? '治療中' : 'コンディショニング'}
                        </span>
                        {inj.body_part_key && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-medium">
                            {getBodyPartLabel(inj.body_part_key)}
                          </span>
                        )}
                        {daysSince != null && (
                          <span className="text-[10px] text-gray-400">{daysSince}日経過</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {prescription && (
                        <span className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-bold">
                          P{prescription.current_phase}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* 展開コンテンツ */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">

                      {/* 処方情報 */}
                      {prescription ? (
                        <div>
                          <div
                            onClick={() => onOpenPrescription?.(prescription.id, athleteId)}
                            className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors group"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                {prescription.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Phase {prescription.current_phase} / {maxPhase}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                          </div>

                          {/* フェーズ進行ボタン */}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handlePhaseChange(prescription.id, prescription.current_phase, 'down')}
                              disabled={prescription.current_phase <= 1}
                              className="flex-1 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              ← リグレッション
                            </button>
                            <button
                              onClick={() => handlePhaseChange(prescription.id, prescription.current_phase, 'up')}
                              disabled={prescription.current_phase >= maxPhase}
                              className="flex-1 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              プログレッション →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onOpenAssign(athleteId, inj.id)}
                          className="w-full py-3 bg-blue-50 dark:bg-blue-900/10 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Plus size={14} /> この怪我にリハビリ処方を作成
                        </button>
                      )}

                      {/* ステータス変更 */}
                      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {inj.status === 'active' && (
                          <button
                            onClick={() => handleInjuryStatusChange(inj.id, 'conditioning')}
                            className="flex-1 py-1.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            コンディショニングへ移行
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('この怪我を完了にしますか？')) {
                              handleInjuryStatusChange(inj.id, 'completed');
                            }
                          }}
                          className="flex-1 py-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          完了にする
                        </button>
                      </div>

                      {/* 評価ボタン */}
                      {onOpenEvaluation && inj.body_part_key && prescription && (
                        <button
                          onClick={() => onOpenEvaluation(inj.id, inj.body_part_key!, prescription.current_phase)}
                          className="w-full py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/10 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors"
                        >
                          評価記録
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== NRS推移 ========== */}
      {recentLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" /> NRS推移（直近14日）
          </h3>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-end gap-1 h-20">
              {recentLogs.map((log, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-colors ${
                      log.pain_level >= 7 ? 'bg-red-500' :
                      log.pain_level >= 4 ? 'bg-orange-400' :
                      log.pain_level >= 2 ? 'bg-amber-300' :
                      'bg-green-300'
                    }`}
                    style={{ height: `${Math.max(log.pain_level * 10, 4)}%` }}
                    title={`${log.log_date}: NRS ${log.pain_level}`}
                  />
                  <span className="text-[8px] text-gray-400">{log.log_date.slice(8)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-400">
              <span>低い ←</span>
              <span>→ 高い（痛み）</span>
            </div>
          </div>
        </div>
      )}

      {/* ========== トレーニングプログラム ========== */}
      {prescriptions.filter(p => !p.injury_id).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-blue-500" /> トレーニングプログラム
          </h3>
          <div className="space-y-2">
            {prescriptions.filter(p => !p.injury_id).map(pres => (
              <div
                key={pres.id}
                onClick={() => onOpenPrescription?.(pres.id, athleteId)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{pres.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      pres.purpose === 'performance' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                      pres.purpose === 'conditioning' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>{pres.purpose === 'performance' ? 'パフォーマンス' : pres.purpose === 'conditioning' ? 'コンディショニング' : 'リハビリ'}</span>
                    <span className="text-[10px] text-gray-500">Phase {pres.current_phase}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== 処方追加ボタン ========== */}
      <button
        onClick={() => onOpenAssign(athleteId, undefined, 'performance')}
        className="w-full py-3 bg-blue-50 dark:bg-blue-900/10 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
      >
        <Plus size={16} /> パフォーマンス / コンディショニング処方を追加
      </button>
    </div>
  );
}
