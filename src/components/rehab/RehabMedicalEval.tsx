import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, Ruler, Dumbbell, Save, CheckCircle,
  Lock, Star, AlertTriangle, Percent, ChevronRight, X, Info
} from 'lucide-react';
import { calculateLSI, getEvalStatus, type EvalMaster } from '../../lib/evaluationLogic';

interface Props {
  athleteId: string;
  injuryId: string;
  currentPhase: number;
  bodySite: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onClose: () => void;
}

export default function RehabMedicalEval({ athleteId, injuryId, currentPhase, bodySite, showToast, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [masterList, setMasterList] = useState<EvalMaster[]>([]);
  const [selectedEval, setSelectedEval] = useState<EvalMaster | null>(null);
  const [inputData, setInputData] = useState({ affected: '', healthy: '', grade: 5, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMaster();
  }, [bodySite]);

  const loadMaster = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.schema('rehab').from('evaluation_master').select('*').eq('body_site', bodySite);
      setMasterList(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEval) return;
    setSaving(true);
    try {
      const lsi = calculateLSI(Number(inputData.affected), Number(inputData.healthy));
      const payload = {
        athlete_id: athleteId,
        injury_id: injuryId,
        eval_master_id: selectedEval.id,
        phase_at_eval: currentPhase,
        data: { ...inputData, lsi },
        notes: inputData.notes
      };

      const { error } = await supabase.schema('rehab').from('medical_evaluations').insert(payload);
      if (error) throw error;
      showToast('評価を記録しました！', 'success');
      setSelectedEval(null);
      setInputData({ affected: '', healthy: '', grade: 5, notes: '' });
      onClose();
    } catch (e: any) {
      showToast('エラー: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black uppercase tracking-[0.2em] text-xs text-gray-400 dark:text-gray-500 min-h-screen bg-white dark:bg-gray-950">Loading Medical Master...</div>;

  return (
    <div className="max-w-md mx-auto p-6 pb-28 space-y-10 bg-white dark:bg-gray-950 min-h-screen">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 dark:text-gray-100 leading-none">Clinical Eval</h2>
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">Phase {currentPhase}</span>
            <span className="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-widest">{bodySite} Site</span>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <Activity className="text-blue-600 dark:text-blue-400" size={28} />
        </div>
      </header>

      {/* 評価項目リスト */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Info size={14} className="text-gray-300 dark:text-gray-600" />
          <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select evaluation target</span>
        </div>

        {masterList.map((item) => {
          const status = getEvalStatus(item, currentPhase);
          return (
            <button
              key={item.id}
              disabled={status === 'LOCKED'}
              onClick={() => setSelectedEval(item)}
              className={`w-full p-5 rounded-xl border-2 flex items-center justify-between transition-all active:scale-[0.97] text-left
                ${status === 'RECOMMENDED' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xl shadow-blue-500/5' :
                  status === 'LOCKED' ? 'border-gray-50 dark:border-gray-800 opacity-30 grayscale' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm'}
              `}
            >
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-b-4 transition-colors ${status === 'RECOMMENDED' ? 'bg-blue-600 text-white border-blue-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'}`}>
                  {status === 'LOCKED' ? <Lock size={20} /> : item.category === 'ROM' ? <Ruler size={20} /> : <Dumbbell size={20} />}
                </div>
                <div>
                  <div className="font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight text-base leading-tight">{item.name}</div>
                  <div className={`text-xs font-black uppercase tracking-widest mt-1 ${status === 'RECOMMENDED' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    Target Phase: {item.recommendPhase}
                  </div>
                </div>
              </div>
              {status === 'RECOMMENDED' && <div className="bg-blue-600 p-1.5 rounded-full shadow-lg"><Star size={12} className="text-white fill-white" /></div>}
            </button>
          );
        })}
      </div>

      {/* 入力モーダル */}
      {selectedEval && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[3rem] p-10 pb-16 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/50">{selectedEval.category}</span>
                <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-tight">{selectedEval.name}</h3>
              </div>
              <button onClick={() => setSelectedEval(null)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={24}/></button>
            </div>

            <div className="space-y-10">
              {/* ROM / CIRCUM / PROTOCOL (数値入力) */}
              {(selectedEval.category === 'ROM' || selectedEval.category === 'CIRCUM' || selectedEval.category === 'PROTOCOL') && selectedEval.unit !== 'grade' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Affected (患側)</label>
                      <div className="relative">
                        <input type="number" value={inputData.affected} onChange={(e) => setInputData({...inputData, affected: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl p-6 text-3xl font-black text-gray-900 dark:text-gray-100 outline-none transition-all" placeholder="0" />
                        <span className="absolute right-4 bottom-4 text-xs font-black text-gray-300 dark:text-gray-600 uppercase">{selectedEval.unit}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Healthy (健側)</label>
                      <div className="relative">
                        <input type="number" value={inputData.healthy} onChange={(e) => setInputData({...inputData, healthy: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl p-6 text-3xl font-black text-gray-900 dark:text-gray-100 outline-none transition-all" placeholder="0" />
                        <span className="absolute right-4 bottom-4 text-xs font-black text-gray-300 dark:text-gray-600 uppercase">{selectedEval.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* LSI リアルタイム表示パネル */}
                  {inputData.affected && inputData.healthy && (
                    <div className="bg-blue-600 rounded-xl p-6 flex items-center justify-between text-white shadow-2xl shadow-blue-500/30 animate-in zoom-in-95">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl"><Percent size={20} /></div>
                        <span className="text-xs font-black uppercase tracking-[0.1em]">LSI (健側比率)</span>
                      </div>
                      <div className="text-4xl font-black">{calculateLSI(Number(inputData.affected), Number(inputData.healthy))}<span className="text-sm ml-1 text-white/60">%</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* MMT (グレード選択) */}
              {selectedEval.category === 'MMT' && (
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 text-center block">Manual Muscle Test Grade</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((num) => (
                      <button key={num} onClick={() => setInputData({...inputData, grade: num})} className={`h-16 rounded-2xl font-black text-xl transition-all border-b-4 ${inputData.grade === num ? 'bg-blue-600 text-white border-blue-800 scale-110 shadow-lg shadow-blue-500/20' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'}`}>
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Notes (臨床所見)</label>
                <textarea placeholder="痛み、制限因子、エンドフィールなど..." value={inputData.notes} onChange={(e) => setInputData({...inputData, notes: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl p-5 text-sm font-bold text-gray-600 dark:text-gray-400 outline-none min-h-[120px] transition-all" />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-6 bg-gray-900 dark:bg-gray-100 hover:bg-black dark:hover:bg-white text-white dark:text-gray-900 rounded-xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
              >
                {saving ? 'Synchronizing...' : <><Save size={20} /> Save Clinical Eval</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
