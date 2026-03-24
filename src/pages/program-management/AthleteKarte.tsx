import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel, BODY_PART_OPTIONS } from '../../lib/rehabConstants';
import {
  ArrowLeft, Stethoscope, ClipboardList, FileText, Clock,
  Plus, X, Save, ChevronDown, ChevronUp, ChevronRight,
  AlertTriangle, MapPin, Calendar as CalendarIcon, User,
  Building2, Zap, Activity, TrendingUp, Share2
} from 'lucide-react';

// ====== Types ======
interface Injury {
  id: string;
  diagnosis: string;
  body_part_key: string | null;
  side: string | null;
  mechanism: string | null;
  injury_date: string | null;
  surgery_date: string | null;
  target_return_date: string | null;
  doctor_name: string | null;
  hospital: string | null;
  injury_site: string | null;
  status: string;
  problem_1: string | null;
  problem_2: string | null;
  problem_3: string | null;
  problem_4: string | null;
  problem_5: string | null;
  created_at: string;
}

interface Prescription {
  id: string;
  title: string;
  purpose: string;
  current_phase: number;
  phase_details: any;
  status: string;
  injury_id: string | null;
  goal: string | null;
  created_at: string;
}

interface MedicalNote {
  id: string;
  injury_id: string | null;
  note_type: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  created_at: string;
  author_user_id: string;
}

interface DailyLog {
  log_date: string;
  pain_level: number;
  prescription_id: string;
}

interface TimelineEvent {
  date: string;
  type: 'injury' | 'prescription' | 'note' | 'evaluation' | 'phase_change' | 'daily_log';
  title: string;
  detail: string;
  color: string;
  icon?: string;
}

type KarteTab = 'injuries' | 'prescriptions' | 'notes' | 'timeline';

interface AthleteKarteProps {
  athleteId: string;
  athleteName: string;
  onBack: () => void;
  onOpenAssign: (athleteId: string, injuryId?: string, purpose?: string) => void;
  onOpenPrescription?: (prescriptionId: string, athleteId: string) => void;
  onGenerateShareLink?: (athleteId: string, injuryId?: string) => void;
}

// ====== Component ======
export function AthleteKarte({
  athleteId,
  athleteName,
  onBack,
  onOpenAssign,
  onOpenPrescription,
  onGenerateShareLink,
}: AthleteKarteProps) {
  const [activeTab, setActiveTab] = useState<KarteTab>('injuries');
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notes, setNotes] = useState<MedicalNote[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 怪我登録フォーム
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({
    diagnosis: '', body_part_key: '', side: '', mechanism: '',
    injury_site: '', injury_date: new Date().toISOString().slice(0, 10),
    surgery_date: '', target_return_date: '', doctor_name: '', hospital: '',
    problem_1: '', problem_2: '', problem_3: '',
  });
  const [injurySaving, setInjurySaving] = useState(false);

  // ノート作成フォーム
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({
    injury_id: '', note_type: 'soap' as 'soap' | 'general',
    subjective: '', objective: '', assessment: '', plan: '', body: '',
  });
  const [noteSaving, setNoteSaving] = useState(false);

  // 展開管理
  const [expandedInjury, setExpandedInjury] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [injRes, presRes, noteRes, logRes] = await Promise.all([
        supabase.schema('rehab').from('injuries')
          .select('*').eq('athlete_user_id', athleteId)
          .order('created_at', { ascending: false }),
        supabase.schema('rehab').from('prescriptions')
          .select('id, title, purpose, current_phase, phase_details, status, injury_id, goal, created_at')
          .eq('athlete_user_id', athleteId)
          .order('created_at', { ascending: false }),
        supabase.schema('rehab').from('medical_notes')
          .select('*').eq('athlete_user_id', athleteId)
          .order('created_at', { ascending: false }),
        supabase.schema('rehab').from('prescription_daily_logs')
          .select('log_date, pain_level, rpe, prescription_id, completed_items, item_results')
          .eq('athlete_user_id', athleteId)
          .order('log_date', { ascending: false }).limit(60),
      ]);
      setInjuries(injRes.data || []);
      setPrescriptions(presRes.data || []);
      setNotes(noteRes.data || []);
      setLogs(logRes.data || []);
    } catch (e) {
      console.error('[AthleteKarte]', e);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ====== Handlers ======
  const handleSaveInjury = async () => {
    if (!injuryForm.diagnosis.trim() || !injuryForm.body_part_key) return;
    setInjurySaving(true);
    try {
      const { error } = await supabase.schema('rehab').from('injuries').insert({
        athlete_user_id: athleteId,
        diagnosis: injuryForm.diagnosis.trim(),
        body_part_key: injuryForm.body_part_key,
        side: injuryForm.side || null,
        mechanism: injuryForm.mechanism.trim() || null,
        injury_site: injuryForm.injury_site.trim() || null,
        injury_date: injuryForm.injury_date || null,
        surgery_date: injuryForm.surgery_date || null,
        target_return_date: injuryForm.target_return_date || null,
        doctor_name: injuryForm.doctor_name.trim() || null,
        hospital: injuryForm.hospital.trim() || null,
        problem_1: injuryForm.problem_1.trim() || null,
        problem_2: injuryForm.problem_2.trim() || null,
        problem_3: injuryForm.problem_3.trim() || null,
        status: 'active',
      });
      if (error) throw error;
      setInjuryForm({ diagnosis: '', body_part_key: '', side: '', mechanism: '', injury_site: '', injury_date: new Date().toISOString().slice(0, 10), surgery_date: '', target_return_date: '', doctor_name: '', hospital: '', problem_1: '', problem_2: '', problem_3: '' });
      setShowInjuryForm(false);
      await fetchData();
    } catch (e: any) {
      alert(e.message || '登録に失敗しました');
    } finally {
      setInjurySaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (noteForm.note_type === 'soap' && !noteForm.subjective && !noteForm.objective) return;
    if (noteForm.note_type === 'general' && !noteForm.body) return;
    setNoteSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証が必要です');
      const { error } = await supabase.schema('rehab').from('medical_notes').insert({
        athlete_user_id: athleteId,
        author_user_id: user.id,
        injury_id: noteForm.injury_id || null,
        note_type: noteForm.note_type,
        subjective: noteForm.subjective || null,
        objective: noteForm.objective || null,
        assessment: noteForm.assessment || null,
        plan: noteForm.plan || null,
        body: noteForm.body || null,
      });
      if (error) throw error;
      setNoteForm({ injury_id: '', note_type: 'soap', subjective: '', objective: '', assessment: '', plan: '', body: '' });
      setShowNoteForm(false);
      await fetchData();
    } catch (e: any) {
      alert(e.message || 'ノート保存に失敗しました');
    } finally {
      setNoteSaving(false);
    }
  };

  const handlePhaseChange = async (prescriptionId: string, currentPhase: number, direction: 'up' | 'down') => {
    const newPhase = direction === 'up' ? currentPhase + 1 : Math.max(1, currentPhase - 1);
    try {
      await supabase.schema('rehab').from('prescriptions').update({ current_phase: newPhase }).eq('id', prescriptionId);
      await fetchData();
    } catch (e: any) {
      alert(e.message || 'フェーズ変更に失敗しました');
    }
  };

  const handleInjuryStatusChange = async (injuryId: string, newStatus: string) => {
    try {
      await supabase.schema('rehab').from('injuries').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', injuryId);
      await fetchData();
    } catch (e: any) {
      alert(e.message || 'ステータス変更に失敗しました');
    }
  };

  // ====== Timeline ======
  const timeline: TimelineEvent[] = (() => {
    const events: TimelineEvent[] = [];

    // 怪我イベント
    injuries.forEach(inj => {
      events.push({
        date: inj.injury_date || inj.created_at.slice(0, 10),
        type: 'injury',
        title: `怪我: ${inj.diagnosis}`,
        detail: `${getBodyPartLabel(inj.body_part_key)} ${getSideLabel(inj.side)}`,
        color: 'red',
        icon: '🩹',
      });
    });

    // 処方イベント
    prescriptions.forEach(prog => {
      const purposeLabel = prog.purpose === 'rehab' ? 'リハビリ' : prog.purpose === 'performance' ? 'パフォーマンス' : 'コンディショニング';
      events.push({
        date: prog.created_at.slice(0, 10),
        type: 'prescription',
        title: `処方開始: ${prog.title}`,
        detail: `${purposeLabel} Phase ${prog.current_phase}`,
        color: prog.purpose === 'rehab' ? 'red' : prog.purpose === 'performance' ? 'blue' : 'green',
        icon: '📋',
      });
    });

    // ノートイベント
    notes.forEach(n => {
      events.push({
        date: n.created_at.slice(0, 10),
        type: 'note',
        title: n.note_type === 'soap' ? 'SOAPノート' : 'メモ',
        detail: n.subjective?.slice(0, 50) || n.body?.slice(0, 50) || '',
        color: 'purple',
        icon: '📝',
      });
    });

    // 日次実施ログ（直近30件）
    const prescriptionMap = new Map(prescriptions.map(prog => [prog.id, prog.title]));
    logs.forEach(log => {
      const progTitle = prescriptionMap.get(log.prescription_id) || '不明';
      const painText = log.pain_level != null ? `NRS ${log.pain_level}` : '';
      events.push({
        date: log.log_date,
        type: 'daily_log',
        title: `実施記録`,
        detail: `${progTitle}${painText ? ` · ${painText}` : ''}`,
        color: log.pain_level != null && log.pain_level >= 7 ? 'red' : log.pain_level != null && log.pain_level >= 4 ? 'orange' : 'gray',
        icon: '✅',
      });
    });

    return events.sort((a, b) => b.date.localeCompare(a.date));
  })();

  // ====== Helpers ======
  const getDaysSince = (d: string | null) => d ? Math.ceil(Math.abs(Date.now() - new Date(d).getTime()) / 86400000) : null;
  const getSideLabel = (s: string | null) => s === 'left' ? '左' : s === 'right' ? '右' : s === 'both' ? '両側' : '';
  const activeInjuries = injuries.filter(i => i.status === 'active' || i.status === 'conditioning');
  const completedInjuries = injuries.filter(i => i.status === 'completed');

  const TABS: { key: KarteTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'injuries', label: '怪我', icon: <Stethoscope size={14} />, count: activeInjuries.length },
    { key: 'prescriptions', label: '処方', icon: <ClipboardList size={14} />, count: prescriptions.filter(p => p.status === 'active').length },
    { key: 'notes', label: 'ノート', icon: <FileText size={14} />, count: notes.length },
    { key: 'timeline', label: '経過', icon: <Clock size={14} /> },
  ];

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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              {athleteName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              怪我 {activeInjuries.length}件 · プログラム {prescriptions.filter(p => p.status === 'active').length}件
            </p>
          </div>
        </div>
        {onGenerateShareLink && (
          <button
            onClick={() => onGenerateShareLink(athleteId)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Share2 size={14} /> 共有
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
        {TABS.map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === key
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {icon} {label}
            {count != null && count > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                activeTab === key ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ========== 怪我タブ ========== */}
      {activeTab === 'injuries' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowInjuryForm(!showInjuryForm)}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                showInjuryForm ? 'bg-gray-200 dark:bg-gray-600 text-gray-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
              }`}
            >
              {showInjuryForm ? <><X size={12} /> 閉じる</> : <><Plus size={12} /> 怪我を登録</>}
            </button>
          </div>

          {/* 怪我登録フォーム */}
          {showInjuryForm && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> 新しい怪我を登録
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 診断名 */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">診断名 *</label>
                  <input type="text" value={injuryForm.diagnosis} onChange={e => setInjuryForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="例: 右膝前十字靭帯損傷" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500" />
                </div>

                {/* 部位 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><MapPin size={10} className="inline mr-1" />部位 *</label>
                  <select value={injuryForm.body_part_key} onChange={e => setInjuryForm(p => ({ ...p, body_part_key: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500">
                    <option value="">部位を選択...</option>
                    {BODY_PART_OPTIONS.map(g => <optgroup key={g.group} label={g.group}>{g.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>)}
                  </select>
                </div>

                {/* 左右 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">左右</label>
                  <select value={injuryForm.side} onChange={e => setInjuryForm(p => ({ ...p, side: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option value="">選択なし</option>
                    <option value="left">左</option>
                    <option value="right">右</option>
                    <option value="both">両側</option>
                  </select>
                </div>

                {/* 受傷機転 */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">受傷機転</label>
                  <input type="text" value={injuryForm.mechanism} onChange={e => setInjuryForm(p => ({ ...p, mechanism: e.target.value }))} placeholder="例: 練習中のジャンプ着地時に膝を捻った" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                {/* 日付 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><CalendarIcon size={10} className="inline mr-1" />受傷日</label>
                  <input type="date" value={injuryForm.injury_date} onChange={e => setInjuryForm(p => ({ ...p, injury_date: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">復帰目標日</label>
                  <input type="date" value={injuryForm.target_return_date} onChange={e => setInjuryForm(p => ({ ...p, target_return_date: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                {/* 医療情報 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><User size={10} className="inline mr-1" />主治医</label>
                  <input type="text" value={injuryForm.doctor_name} onChange={e => setInjuryForm(p => ({ ...p, doctor_name: e.target.value }))} placeholder="Dr. 〇〇" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"><Building2 size={10} className="inline mr-1" />病院</label>
                  <input type="text" value={injuryForm.hospital} onChange={e => setInjuryForm(p => ({ ...p, hospital: e.target.value }))} placeholder="〇〇整形外科" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                {/* 問題点 */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">主要な問題点</label>
                  {[1, 2, 3].map(n => (
                    <input key={n} type="text" value={(injuryForm as any)[`problem_${n}`]} onChange={e => setInjuryForm(p => ({ ...p, [`problem_${n}`]: e.target.value }))} placeholder={`問題点 ${n}`} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  ))}
                </div>
              </div>

              <button onClick={handleSaveInjury} disabled={injurySaving || !injuryForm.diagnosis.trim() || !injuryForm.body_part_key} className="w-full py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                <Save size={14} /> {injurySaving ? '登録中...' : '怪我を登録'}
              </button>
            </div>
          )}

          {/* 怪我カード一覧 */}
          {activeInjuries.length === 0 && !showInjuryForm ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
              <Stethoscope size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">アクティブな怪我はありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeInjuries.map(inj => {
                const prescription = prescriptions.find(p => p.injury_id === inj.id && p.status === 'active');
                const isExpanded = expandedInjury === inj.id;
                const maxPhase = Array.isArray(prescription?.phase_details) ? prescription.phase_details.length : 1;
                return (
                  <div key={inj.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedInjury(isExpanded ? null : inj.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-900 dark:text-white">{getSideLabel(inj.side)}{inj.diagnosis}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${inj.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                            {inj.status === 'active' ? '治療中' : 'コンディショニング'}
                          </span>
                          {inj.body_part_key && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{getBodyPartLabel(inj.body_part_key)}</span>}
                          {inj.injury_date && <span className="text-[10px] text-gray-400">{getDaysSince(inj.injury_date)}日経過</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {prescription && <span className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-bold">P{prescription.current_phase}/{maxPhase}</span>}
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                        {/* 詳細情報 */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {inj.mechanism && <div className="col-span-2"><span className="text-gray-400">受傷機転:</span> <span className="text-gray-700 dark:text-gray-300">{inj.mechanism}</span></div>}
                          {inj.doctor_name && <div><span className="text-gray-400">主治医:</span> <span className="text-gray-700 dark:text-gray-300">{inj.doctor_name}</span></div>}
                          {inj.hospital && <div><span className="text-gray-400">病院:</span> <span className="text-gray-700 dark:text-gray-300">{inj.hospital}</span></div>}
                          {inj.surgery_date && <div><span className="text-gray-400">手術日:</span> <span className="text-gray-700 dark:text-gray-300">{inj.surgery_date}</span></div>}
                          {inj.target_return_date && <div><span className="text-gray-400">復帰目標:</span> <span className="text-gray-700 dark:text-gray-300">{inj.target_return_date}</span></div>}
                          {[inj.problem_1, inj.problem_2, inj.problem_3, inj.problem_4, inj.problem_5].filter(Boolean).length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-400">問題点:</span>
                              <ul className="mt-1 space-y-0.5">
                                {[inj.problem_1, inj.problem_2, inj.problem_3, inj.problem_4, inj.problem_5].filter(Boolean).map((p, i) => (
                                  <li key={i} className="text-gray-700 dark:text-gray-300">• {p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* 処方 */}
                        {prescription ? (
                          <div>
                            <div onClick={() => onOpenPrescription?.(prescription.id, athleteId)} className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors group">
                              <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{prescription.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Phase {prescription.current_phase} / {maxPhase}</div>
                              </div>
                              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handlePhaseChange(prescription.id, prescription.current_phase, 'down')} disabled={prescription.current_phase <= 1} className="flex-1 py-2 text-xs font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/10 rounded-lg hover:bg-orange-100 disabled:opacity-30 transition-colors">← リグレッション</button>
                              <button onClick={() => handlePhaseChange(prescription.id, prescription.current_phase, 'up')} disabled={prescription.current_phase >= maxPhase} className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-lg hover:bg-blue-100 disabled:opacity-30 transition-colors">プログレッション →</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => onOpenAssign(athleteId, inj.id, 'rehab')} className="w-full py-3 bg-blue-50 dark:bg-blue-900/10 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors">
                            <Plus size={14} /> リハビリ処方を作成
                          </button>
                        )}

                        {/* ステータス変更 */}
                        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          {inj.status === 'active' && (
                            <button onClick={() => handleInjuryStatusChange(inj.id, 'conditioning')} className="flex-1 py-1.5 text-[10px] font-semibold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">コンディショニングへ</button>
                          )}
                          <button onClick={() => { if (confirm('この怪我を完了にしますか？')) handleInjuryStatusChange(inj.id, 'completed'); }} className="flex-1 py-1.5 text-[10px] font-semibold text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">完了にする</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 完了した怪我 */}
          {completedInjuries.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">完了した怪我（{completedInjuries.length}件）</summary>
              <div className="mt-2 space-y-1">
                {completedInjuries.map(inj => (
                  <div key={inj.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-500">
                    <span className="font-medium">{getSideLabel(inj.side)}{inj.diagnosis}</span>
                    <span className="ml-2 text-gray-400">{getBodyPartLabel(inj.body_part_key)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ========== 処方タブ ========== */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-3">
          {/* リハビリ処方 */}
          {prescriptions.filter(p => p.purpose === 'rehab' && p.status === 'active').length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1"><Stethoscope size={12} /> リハビリ</h4>
              <div className="space-y-1.5">
                {prescriptions.filter(p => p.purpose === 'rehab' && p.status === 'active').map(p => (
                  <PrescriptionCard key={p.id} prescription={p} onOpen={() => onOpenPrescription?.(p.id, athleteId)} onPhaseChange={handlePhaseChange} logs={logs} />
                ))}
              </div>
            </div>
          )}

          {/* パフォーマンス処方 */}
          {prescriptions.filter(p => p.purpose === 'performance' && p.status === 'active').length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1"><Zap size={12} /> パフォーマンス</h4>
              <div className="space-y-1.5">
                {prescriptions.filter(p => p.purpose === 'performance' && p.status === 'active').map(p => (
                  <PrescriptionCard key={p.id} prescription={p} onOpen={() => onOpenPrescription?.(p.id, athleteId)} onPhaseChange={handlePhaseChange} logs={logs} />
                ))}
              </div>
            </div>
          )}

          {/* コンディショニング処方 */}
          {prescriptions.filter(p => p.purpose === 'conditioning' && p.status === 'active').length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-green-500 mb-2 flex items-center gap-1"><Activity size={12} /> コンディショニング</h4>
              <div className="space-y-1.5">
                {prescriptions.filter(p => p.purpose === 'conditioning' && p.status === 'active').map(p => (
                  <PrescriptionCard key={p.id} prescription={p} onOpen={() => onOpenPrescription?.(p.id, athleteId)} onPhaseChange={handlePhaseChange} logs={logs} />
                ))}
              </div>
            </div>
          )}

          {/* 新規作成ボタン */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button onClick={() => onOpenAssign(athleteId, undefined, 'rehab')} className="py-3 border-2 border-dashed border-red-200 dark:border-red-800 rounded-xl text-red-600 font-semibold text-[10px] flex flex-col items-center gap-1 hover:bg-red-50 transition-colors">
              <Stethoscope size={16} /> リハビリ
            </button>
            <button onClick={() => onOpenAssign(athleteId, undefined, 'performance')} className="py-3 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl text-blue-600 font-semibold text-[10px] flex flex-col items-center gap-1 hover:bg-blue-50 transition-colors">
              <Zap size={16} /> パフォーマンス
            </button>
            <button onClick={() => onOpenAssign(athleteId, undefined, 'conditioning')} className="py-3 border-2 border-dashed border-green-200 dark:border-green-800 rounded-xl text-green-600 font-semibold text-[10px] flex flex-col items-center gap-1 hover:bg-green-50 transition-colors">
              <Activity size={16} /> コンディショニング
            </button>
          </div>
        </div>
      )}

      {/* ========== ノートタブ ========== */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowNoteForm(!showNoteForm)} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${showNoteForm ? 'bg-gray-200 text-gray-600' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
              {showNoteForm ? <><X size={12} /> 閉じる</> : <><Plus size={12} /> ノート追加</>}
            </button>
          </div>

          {showNoteForm && (
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 space-y-3">
              {/* タイプ選択 */}
              <div className="flex gap-2">
                <button onClick={() => setNoteForm(p => ({ ...p, note_type: 'soap' }))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${noteForm.note_type === 'soap' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>SOAP</button>
                <button onClick={() => setNoteForm(p => ({ ...p, note_type: 'general' }))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${noteForm.note_type === 'general' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}>メモ</button>
              </div>

              {/* 怪我紐付け */}
              {activeInjuries.length > 0 && (
                <select value={noteForm.injury_id} onChange={e => setNoteForm(p => ({ ...p, injury_id: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <option value="">怪我に紐付けない</option>
                  {activeInjuries.map(inj => <option key={inj.id} value={inj.id}>{getSideLabel(inj.side)}{inj.diagnosis}</option>)}
                </select>
              )}

              {noteForm.note_type === 'soap' ? (
                <div className="space-y-2">
                  {[
                    { key: 'subjective', label: 'S: 主訴（選手の言葉）', placeholder: '「走ると膝が痛い」' },
                    { key: 'objective', label: 'O: 客観的所見', placeholder: 'ROM: 膝屈曲120°、腫脹(-)' },
                    { key: 'assessment', label: 'A: 評価・判断', placeholder: '膝蓋腱の過負荷が疑われる' },
                    { key: 'plan', label: 'P: 計画', placeholder: 'Phase 2に進行。大腿四頭筋の強化を追加' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                      <textarea value={(noteForm as any)[key]} onChange={e => setNoteForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                    </div>
                  ))}
                </div>
              ) : (
                <textarea value={noteForm.body} onChange={e => setNoteForm(p => ({ ...p, body: e.target.value }))} placeholder="メモを入力..." rows={4} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
              )}

              <button onClick={handleSaveNote} disabled={noteSaving} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                <Save size={14} /> {noteSaving ? '保存中...' : 'ノートを保存'}
              </button>
            </div>
          )}

          {/* ノート一覧 */}
          {notes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
              <FileText size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">ノートはまだありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(note => {
                const linkedInjury = injuries.find(i => i.id === note.injury_id);
                return (
                  <div key={note.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${note.note_type === 'soap' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                          {note.note_type === 'soap' ? 'SOAP' : 'メモ'}
                        </span>
                        {linkedInjury && <span className="text-[10px] text-gray-400">{linkedInjury.diagnosis}</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{note.created_at.slice(0, 10)}</span>
                    </div>
                    {note.note_type === 'soap' ? (
                      <div className="space-y-1 text-xs">
                        {note.subjective && <div><span className="font-bold text-blue-600">S:</span> <span className="text-gray-700 dark:text-gray-300">{note.subjective}</span></div>}
                        {note.objective && <div><span className="font-bold text-green-600">O:</span> <span className="text-gray-700 dark:text-gray-300">{note.objective}</span></div>}
                        {note.assessment && <div><span className="font-bold text-orange-600">A:</span> <span className="text-gray-700 dark:text-gray-300">{note.assessment}</span></div>}
                        {note.plan && <div><span className="font-bold text-purple-600">P:</span> <span className="text-gray-700 dark:text-gray-300">{note.plan}</span></div>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.body}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== タイムラインタブ ========== */}
      {activeTab === 'timeline' && (
        <div className="space-y-0">
          {timeline.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
              <Clock size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">経過記録はありません</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

              {timeline.map((event, idx) => {
                const dotColor =
                  event.color === 'red' ? 'bg-red-500' :
                  event.color === 'blue' ? 'bg-blue-500' :
                  event.color === 'green' ? 'bg-green-500' :
                  event.color === 'orange' ? 'bg-orange-500' :
                  event.color === 'purple' ? 'bg-purple-500' :
                  'bg-gray-400';

                const borderColor =
                  event.type === 'daily_log' ? 'border-gray-100 dark:border-gray-700/50' :
                  'border-gray-200 dark:border-gray-700';

                const bgColor =
                  event.type === 'daily_log' ? 'bg-gray-50 dark:bg-gray-800/50' :
                  'bg-white dark:bg-gray-800';

                return (
                  <div key={idx} className="relative pb-3">
                    {/* Dot */}
                    <div className={`absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${dotColor}`} />

                    <div className={`${bgColor} border ${borderColor} rounded-lg p-3 ml-2`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          {event.icon && <span className="text-xs">{event.icon}</span>}
                          <span className={`font-semibold ${event.type === 'daily_log' ? 'text-[11px] text-gray-600 dark:text-gray-400' : 'text-xs text-gray-900 dark:text-white'}`}>{event.title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{event.date}</span>
                      </div>
                      {event.detail && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{event.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ====== Prescription Card with Activity Log ======
function PrescriptionCard({ prescription: pres, onOpen, onPhaseChange, logs: presLogs }: {
  prescription: Prescription;
  onOpen: () => void;
  onPhaseChange: (id: string, current: number, dir: 'up' | 'down') => void;
  logs?: DailyLog[];
}) {
  const [showLogs, setShowLogs] = useState(false);
  const maxPhase = pres.phase_details ? (typeof pres.phase_details === 'object' ? Object.keys(pres.phase_details).length : 1) : 1;
  const progress = maxPhase > 0 ? (pres.current_phase / maxPhase) * 100 : 0;
  const purposeColor = pres.purpose === 'rehab' ? 'red' : pres.purpose === 'performance' ? 'blue' : 'green';
  const isRehab = pres.purpose === 'rehab';

  // この処方のログのみ
  const myLogs = (presLogs || []).filter(l => l.prescription_id === pres.id).slice(0, 14);
  const logCount = myLogs.length;
  const lastLog = myLogs[0];
  const lastLogDaysAgo = lastLog ? Math.ceil(Math.abs(Date.now() - new Date(lastLog.log_date).getTime()) / 86400000) : null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="p-3">
        <div onClick={onOpen} className="flex items-center justify-between cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">{pres.title}</div>
            {pres.goal && <div className="text-[10px] text-gray-400 mt-0.5 truncate">目標: {pres.goal}</div>}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-${purposeColor}-500`} style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <span className="text-[10px] font-bold text-gray-400">P{pres.current_phase}/{maxPhase}</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 ml-2" />
        </div>

        {/* フェーズ変更ボタン */}
        <div className="flex gap-2 mt-2">
          <button onClick={() => onPhaseChange(pres.id, pres.current_phase, 'down')} disabled={pres.current_phase <= 1} className="flex-1 py-1.5 text-[10px] font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/10 rounded-lg disabled:opacity-30 transition-colors">← リグレ</button>
          <button onClick={() => onPhaseChange(pres.id, pres.current_phase, 'up')} disabled={pres.current_phase >= maxPhase} className="flex-1 py-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-lg disabled:opacity-30 transition-colors">プログレ →</button>
        </div>

        {/* 実施状況サマリー */}
        {logCount > 0 && (
          <button onClick={() => setShowLogs(!showLogs)} className="w-full mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-green-500" />
              <span>直近実施: {lastLogDaysAgo === 0 ? '今日' : lastLogDaysAgo === 1 ? '昨日' : `${lastLogDaysAgo}日前`}</span>
              {lastLog && (
                <span className={`px-1.5 py-0.5 rounded font-bold ${
                  isRehab
                    ? (lastLog.pain_level >= 7 ? 'bg-red-100 text-red-600' : lastLog.pain_level >= 4 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600')
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {isRehab ? `NRS ${lastLog.pain_level}` : lastLog.rpe ? `RPE ${lastLog.rpe}` : ''}
                </span>
              )}
              <span>計{logCount}回実施</span>
            </div>
            <ChevronDown size={12} className={`transition-transform ${showLogs ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* 展開: 直近ログ一覧 */}
      {showLogs && myLogs.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 px-3 py-2">
          <div className="space-y-1">
            {myLogs.map((log, idx) => {
              const completedCount = log.completed_items ? (Array.isArray(log.completed_items) ? log.completed_items.length : 0) : 0;
              return (
                <div key={idx} className="flex items-center justify-between text-[10px] py-1">
                  <span className="text-gray-500 font-medium w-16">{log.log_date.slice(5)}</span>
                  <span className="text-gray-400">{completedCount}項目完了</span>
                  {isRehab && log.pain_level != null && (
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      log.pain_level >= 7 ? 'bg-red-100 text-red-600' :
                      log.pain_level >= 4 ? 'bg-orange-100 text-orange-600' :
                      'bg-green-100 text-green-600'
                    }`}>NRS {log.pain_level}</span>
                  )}
                  {!isRehab && log.rpe != null && (
                    <span className="px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-600">RPE {log.rpe}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AthleteKarte;
