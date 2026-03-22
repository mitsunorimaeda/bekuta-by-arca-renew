import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel, getPurposeLabel, type PrescriptionPurpose } from '../../lib/rehabConstants';
import {
  FileText, Save, ArrowLeft, Plus, Trash2,
  Info, Layers, Dumbbell, Sword, Trophy, Youtube, Stethoscope, PlusCircle, MinusCircle
} from 'lucide-react';

interface RehabPrescriptionAssignProps {
  athleteId: string;
  injuryId?: string;
  fromPrescriptionId?: string;
  purpose?: PrescriptionPurpose;
  onBack: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function RehabPrescriptionAssign({
  athleteId,
  injuryId: propInjuryId,
  fromPrescriptionId,
  purpose: propPurpose,
  onBack,
  showToast,
}: RehabPrescriptionAssignProps) {
  const purpose = propPurpose || 'rehab';
  const isRehab = purpose === 'rehab';
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [activePhaseTab, setActivePhaseTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideoIdx, setActiveVideoIdx] = useState<number | null>(null);

  const [injuries, setInjuries] = useState<any[]>([]);
  const [selectedInjuryId, setSelectedInjuryId] = useState<string>(propInjuryId || '');

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    progress_mode: 'manual'
  });

  const [phaseMetadata, setPhaseMetadata] = useState<Record<number, { description: string, boss: string }>>({
    1: { description: '', boss: '' },
    2: { description: '', boss: '' },
    3: { description: '', boss: '' },
    4: { description: '', boss: '' },
    5: { description: '', boss: '' },
  });

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchInjuries();
    if (fromPrescriptionId) {
      loadInitialData(fromPrescriptionId);
    }
  }, [fromPrescriptionId]);

  const fetchInjuries = async () => {
    if (!athleteId) return;
    const { data } = await supabase.schema('rehab').from('injuries')
      .select('id, diagnosis, body_part_key, injury_site, status')
      .eq('athlete_user_id', athleteId)
      .in('status', ['active', 'conditioning'])
      .order('created_at', { ascending: false });
    setInjuries(data || []);
  };

  const getYoutubeId = (url: string | undefined | null) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('id, title, description')
        .eq('type', 'template')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) { console.error(err.message); }
  };

  const loadInitialData = async (prescriptionId: string) => {
    setLoading(true);
    try {
      const { data: prescription, error: pError } = await supabase
        .schema('rehab').from('prescriptions')
        .select(`*, prescription_items (*)`)
        .eq('id', prescriptionId).single();
      if (pError) throw pError;

      if (prescription) {
        setForm({
          title: `${prescription.title} (更新)`,
          description: prescription.description || '',
          start_date: new Date().toISOString().split('T')[0],
          progress_mode: prescription.progress_mode || 'manual'
        });
        if (prescription.phase_details) setPhaseMetadata(prev => ({ ...prev, ...prescription.phase_details }));
        if (prescription.prescription_items) {
          setItems(prescription.prescription_items.map((item: any) => ({
            name: item.name, quantity: item.quantity, sets: item.sets,
            phase: item.phase || 1, xp: item.xp || 10,
            icon_type: item.icon_type || 'training', video_url: item.video_url || ''
          })));
        }
      }
    } catch (err: any) { console.error(err.message); } finally { setLoading(false); }
  };

  const handleTemplateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (!newId) return;
    if (!window.confirm("現在の編集内容は上書きされます。よろしいですか？")) return;

    setSelectedTemplateId(newId);
    const selectedTmpl = templates.find(t => t.id === newId);
    if (selectedTmpl) {
      setForm(prev => ({ ...prev, title: selectedTmpl.title, description: selectedTmpl.description }));
      const { data: templateItems } = await supabase.schema('rehab').from('prescription_items').select('*').eq('prescription_id', newId).order('phase', { ascending: true }).order('item_index', { ascending: true });
      if (templateItems) {
        setItems(templateItems.map(item => ({
          name: item.name, quantity: item.quantity, sets: item.sets,
          phase: item.phase, xp: item.xp, icon_type: item.icon_type, video_url: item.video_url || ''
        })));
      }
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const updatePhaseMeta = (phaseId: number, field: 'description' | 'boss', value: string) => {
    setPhaseMetadata(prev => ({ ...prev, [phaseId]: { ...prev[phaseId], [field]: value } }));
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const addItem = (phaseId: number) => setItems([...items, { name: '', quantity: '10回', sets: '3セット', phase: phaseId, xp: 10, icon_type: 'training', video_url: '' }]);

  const handleSubmit = async () => {
    if (!athleteId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (isRehab && selectedInjuryId) {
        await supabase.schema('rehab').from('prescriptions')
          .update({ status: 'completed' })
          .eq('injury_id', selectedInjuryId)
          .eq('status', 'active');
      }
      // 同じpurposeの既存active処方を完了にする
      const archiveQuery = supabase.schema('rehab').from('prescriptions')
        .update({ status: 'completed' })
        .eq('athlete_user_id', athleteId)
        .eq('status', 'active')
        .eq('purpose', purpose)
        .neq('type', 'template');
      if (isRehab) archiveQuery.is('injury_id', null);
      await archiveQuery;

      const { data: newPrescription, error: pError } = await supabase.schema('rehab').from('prescriptions').insert({
        athlete_user_id: athleteId, trainer_id: user.id,
        type: isRehab ? 'rehab' : 'performance',
        purpose: purpose,
        title: form.title, description: form.description, phase_details: phaseMetadata,
        start_date: form.start_date, progress_mode: form.progress_mode, status: 'active',
        injury_id: isRehab ? (selectedInjuryId || null) : null,
      }).select().single();
      if (pError) throw pError;
      if (items.length > 0) {
        await supabase.schema('rehab').from('prescription_items').insert(items.map((item, index) => ({
          prescription_id: newPrescription.id, name: item.name, quantity: item.quantity,
          sets: item.sets, phase: item.phase, item_index: index, xp: item.xp,
          icon_type: item.icon_type, video_url: item.video_url || null
        })));
      }
      showToast('プログラムを更新しました', 'success');
      onBack();
    } catch (error: any) { showToast(error.message, 'error'); } finally { setLoading(false); }
  };

  const phases = Object.keys(phaseMetadata).map(k => Number(k)).sort((a, b) => a - b);

  const addPhase = () => {
    const nextId = phases.length > 0 ? Math.max(...phases) + 1 : 1;
    setPhaseMetadata(prev => ({ ...prev, [nextId]: { description: '', boss: '' } }));
  };

  const removePhase = (phaseId: number) => {
    if (phases.length <= 1) {
      showToast("最低1つのフェーズが必要です", 'error');
      return;
    }
    const phaseItems = items.filter(i => i.phase === phaseId);
    if (phaseItems.length > 0 && !window.confirm(`Phase ${phaseId} には ${phaseItems.length} 個のエクササイズがあります。削除しますか？`)) return;
    setItems(items.filter(i => i.phase !== phaseId));
    setPhaseMetadata(prev => {
      const next = { ...prev };
      delete next[phaseId];
      return next;
    });
    if (activePhaseTab === phaseId) setActivePhaseTab(phases.find(p => p !== phaseId) || 1);
  };

  const currentPhaseMeta = phaseMetadata[activePhaseTab] || { description: '', boss: '' };

  if (loading && items.length === 0) return <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center font-black text-gray-300 dark:text-gray-600">LOADING DATA...</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 pb-32">
      {/* Header */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 p-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 font-black text-sm transition-all active:scale-95">
            <ArrowLeft size={20} /> 戻る
          </button>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">リハビリプログラム<span className="text-blue-600 dark:text-blue-400">設定</span></h1>
          <div className="w-20"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 mt-10 grid grid-cols-1 lg:grid-cols-4 gap-10">

        {/* Left Col: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-gray-800">
            <h2 className="text-xs font-black mb-8 text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} className="text-blue-500 dark:text-blue-400" /> 基本設定
            </h2>
            <div className="space-y-6">
              {/* 怪我選択 */}
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                <label className="block text-xs font-black text-rose-600 dark:text-rose-400 uppercase mb-2 tracking-widest px-1 flex items-center gap-1"><Stethoscope size={12} /> 対象の怪我</label>
                <select
                  value={selectedInjuryId}
                  onChange={(e) => setSelectedInjuryId(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-gray-100 font-black text-xs p-3 outline-none shadow-sm"
                >
                  <option value="">怪我を選択...</option>
                  {injuries.map(inj => (
                    <option key={inj.id} value={inj.id}>
                      {inj.diagnosis} ({getBodyPartLabel(inj.body_part_key)})
                    </option>
                  ))}
                </select>
                {injuries.length === 0 && (
                  <p className="text-xs text-rose-400 dark:text-rose-500 mt-2 px-1">この選手にはアクティブな怪我がありません</p>
                )}
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                <label className="block text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-2 tracking-widest px-1">テンプレート選択</label>
                <select value={selectedTemplateId} onChange={handleTemplateChange} className="w-full bg-white dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-gray-100 font-black text-xs p-3 outline-none shadow-sm">
                  <option value="">選択してください</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase ml-1 tracking-widest">タイトル</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-900 dark:text-gray-100 font-bold text-sm border-2 border-transparent focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase ml-1 tracking-widest">プログラム概要</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-900 dark:text-gray-100 font-bold text-xs h-32 resize-none outline-none focus:border-blue-500 border-2 border-transparent transition-all" />
              </div>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={loading} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm">
            {loading ? '保存中...' : <><Save size={20} /> 保存</>}
          </button>
        </div>

        {/* Right Col: Editor */}
        <div className="lg:col-span-3 space-y-6">
          {/* Phase Tabs */}
          <div className="flex bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto no-scrollbar gap-2 items-center">
            {phases.map((phaseId) => (
              <div key={phaseId} className="relative flex-shrink-0">
                <button onClick={() => setActivePhaseTab(phaseId)} className={`min-w-[100px] py-4 px-4 rounded-2xl text-xs font-black uppercase transition-all flex flex-col items-center justify-center ${activePhaseTab === phaseId ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span>Phase {phaseId}</span>
                  <span className="truncate max-w-[100px] text-center">{phaseMetadata[phaseId]?.description?.substring(0, 15) || ''}</span>
                </button>
                {phases.length > 1 && (
                  <button onClick={() => removePhase(phaseId)} className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-rose-600 shadow"><MinusCircle size={12} /></button>
                )}
              </div>
            ))}
            <button onClick={addPhase} className="flex-shrink-0 w-10 h-10 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all">
              <PlusCircle size={18} />
            </button>
          </div>

          {/* Phase Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <label className="text-xs font-black text-blue-500 dark:text-blue-400 uppercase mb-3 flex items-center gap-2 tracking-widest"><Info size={14} /> フェーズ目標</label>
              <textarea value={currentPhaseMeta.description} onChange={(e) => updatePhaseMeta(activePhaseTab, 'description', e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-xs font-bold text-gray-700 dark:text-gray-300 h-24 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900" placeholder="このフェーズの目標..." />
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <label className="text-xs font-black text-rose-500 dark:text-rose-400 uppercase mb-3 flex items-center gap-2 tracking-widest"><Trophy size={14} /> フェーズ移行条件</label>
              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <Sword size={18} className="text-rose-400 mr-3" />
                <input type="text" value={currentPhaseMeta.boss} onChange={(e) => updatePhaseMeta(activePhaseTab, 'boss', e.target.value)} className="w-full bg-transparent border-none p-0 text-sm font-black text-gray-700 dark:text-gray-300 outline-none" placeholder="例: 10kmランニング完走" />
              </div>
            </div>
          </div>

          {/* Exercise List */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-8 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="font-black text-gray-900 dark:text-gray-100 flex items-center gap-3 uppercase tracking-tighter"><Layers className="text-blue-600 dark:text-blue-400" size={24} /> エクササイズ</h2>
              <button onClick={() => addItem(activePhaseTab)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"><Plus size={18} /> メニュー追加</button>
            </div>

            <div className="p-8 space-y-4 flex-1">
              {items.filter(i => i.phase === activePhaseTab).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 opacity-20 text-gray-400 dark:text-gray-600"><Dumbbell size={64} /><p className="mt-4 font-black uppercase text-xs">メニューなし</p></div>
              ) : (
                items.map((item, idx) => item.phase === activePhaseTab && (
                  <div key={idx} className="space-y-3">
                    <div className="group bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-2 border-transparent hover:border-blue-500/20 hover:bg-white dark:hover:bg-gray-900 transition-all shadow-sm flex flex-col md:flex-row gap-6 items-center">
                      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-900 flex items-center justify-center text-xs font-black text-gray-300 dark:text-gray-600 border border-gray-100 dark:border-gray-700">{items.filter((it, i) => it.phase === activePhaseTab && i <= idx).length}</div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                        <div className="md:col-span-2">
                          <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-1 block tracking-widest">種目名</label>
                          <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full bg-transparent border-none p-0 text-lg font-black text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-200 dark:placeholder:text-gray-700" placeholder="種目名..." />
                        </div>
                        <div>
                          <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-1 block tracking-widest">回数</label>
                          <input type="text" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full bg-transparent border-none p-0 text-sm font-black text-gray-600 dark:text-gray-400 outline-none" />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-1 block tracking-widest">セット</label>
                            <input type="text" value={item.sets} onChange={e => updateItem(idx, 'sets', e.target.value)} className="w-full bg-transparent border-none p-0 text-sm font-black text-gray-600 dark:text-gray-400 outline-none" />
                          </div>

                          {item.video_url && (
                            <button onClick={() => setActiveVideoIdx(activeVideoIdx === idx ? null : idx)} className={`p-3 rounded-2xl transition-all ${activeVideoIdx === idx ? 'bg-rose-500 text-white shadow-lg' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/30'}`}><Youtube size={20} /></button>
                          )}
                          <button onClick={() => removeItem(idx)} className="text-gray-300 dark:text-gray-600 hover:text-rose-500 transition-colors p-2"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    </div>

                    {item.video_url && activeVideoIdx === idx && getYoutubeId(item.video_url) && (
                      <div className="px-2 animate-in slide-in-from-top-4 duration-300">
                        <div className="aspect-video bg-black rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl">
                          <iframe
                            width="100%" height="100%"
                            src={`https://www.youtube.com/embed/${getYoutubeId(item.video_url)}?rel=0&modestbranding=1&enablejsapi=1`}
                            title="Exercise Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full"
                          ></iframe>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
