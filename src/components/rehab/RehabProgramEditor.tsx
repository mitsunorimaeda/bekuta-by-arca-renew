import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Map as MapIcon, Save, Plus, X,
  Sword, Shield, Heart, Zap, Coffee, Brain, Activity,
  Layers, Info, Trophy, Dumbbell, ArrowLeft, Clock, Youtube,
  Settings, ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import { BODY_PART_OPTIONS } from '../../lib/rehabConstants';

// 型定義
type QuestType = 'training' | 'care' | 'cardio' | 'mental' | 'life';

type Quest = {
  id: number;
  title: string;
  quantity: string;
  sets: string;
  type: QuestType;
  video_url?: string;
};

type Phase = {
  id: number;
  title: string;
  description: string;
  boss: string;
  quests: Quest[];
};

type ScenarioData = {
  title: string;
  description: string;
  duration: string;
  body_part_key: string;
  phases: Phase[];
};

interface RehabProgramEditorProps {
  templateId?: string;
  onBack: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function RehabProgramEditor({ templateId, onBack, showToast }: RehabProgramEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exerciseMaster, setExerciseMaster] = useState<any[]>([]);
  // スマホ用：概要エリアの開閉状態
  const [showMobileInfo, setShowMobileInfo] = useState(false);

  const [data, setData] = useState<ScenarioData>({
    title: "新規リハビリシナリオ",
    description: "",
    duration: "3ヶ月",
    body_part_key: "",
    phases: [
      { id: 1, title: "Phase 1: 急性期", description: "患部の安静と炎症コントロールを行う最初のステップです。", boss: "炎症の消失・自動可動域の改善", quests: [] },
      { id: 2, title: "Phase 2: 可動域回復", description: "本格的なリハビリの開始。柔軟性と可動域を取り戻します。", boss: "全可動域の獲得", quests: [] },
      { id: 3, title: "Phase 3: 筋力強化", description: "失われた筋力を呼び覚まし、土台を強固にします。", boss: "左右差20%以内", quests: [] },
      { id: 4, title: "Phase 4: 動作改善", description: "ジャンプやダッシュなど、競技に必要な動きを身につけます。", boss: "ジョギング・アジリティ開始許可", quests: [] },
      { id: 5, title: "Phase 5: 競技復帰", description: "対人練習への合流と、完全な競技復帰を目指します。", boss: "完全復帰", quests: [] },
    ]
  });

  const [focusedPhaseIdx, setFocusedPhaseIdx] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // 未保存のまま離脱しようとした時の警告
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (templateId) loadTemplateData(templateId);
    fetchExerciseMaster();
  }, [templateId]);

  const fetchExerciseMaster = async () => {
    const { data: master } = await supabase.schema('rehab').from('exercise_master').select('*');
    if (master) setExerciseMaster(master);
  };

  const loadTemplateData = async (id: string) => {
    setLoading(true);
    try {
      const { data: template, error: tError } = await supabase
        .schema('rehab').from('prescriptions').select('*').eq('id', id).single();
      if (tError) throw tError;

      const { data: items, error: iError } = await supabase
        .schema('rehab').from('prescription_items').select('*').eq('prescription_id', id).order('item_index', { ascending: true });
      if (iError) throw iError;

      const restoredPhases = data.phases.map((p, idx) => {
        const phaseNumber = idx + 1;
        return {
          ...p,
          quests: items
            .filter(item => item.phase === phaseNumber)
            .map(item => ({
              id: item.id,
              title: item.name,
              quantity: item.quantity,
              sets: item.sets,
              type: (item.icon_type as QuestType) || 'training',
              video_url: item.video_url || ""
            }))
        };
      });

      setData({
        title: template.title,
        description: template.description || "",
        duration: template.estimated_duration || "3ヶ月",
        body_part_key: template.body_part_key || "",
        phases: restoredPhases
      });
    } catch (err: any) {
      showToast("データの読み込み失敗: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getYoutubeId = (url: string | undefined | null) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const syncExerciseMaster = async (trainerId: string, quests: Quest[]) => {
    try {
      const newMasterItems = quests
        .filter(q => q.title.trim() !== "")
        .map(q => ({
          trainer_id: trainerId,
          name: q.title.trim(),
          category: q.type,
          video_url: q.video_url || null
        }));

      if (newMasterItems.length > 0) {
        const uniqueItemsMap = new window.Map();
        newMasterItems.forEach(item => {
          const key = `${item.category}-${item.name}`;
          if (!uniqueItemsMap.has(key)) uniqueItemsMap.set(key, item);
        });

        await supabase.schema('rehab').from('exercise_master').upsert(Array.from(uniqueItemsMap.values()), {
          onConflict: 'trainer_id, category, name'
        });
      }
    } catch (e) { console.error("Master Sync Error:", e); }
  };

  const updatePhase = (idx: number, field: keyof Phase, val: any) => {
    const newPhases = [...data.phases];
    (newPhases[idx] as any)[field] = val;
    setData({ ...data, phases: newPhases });
  };

  const updateQuest = (phaseIdx: number, questIdx: number, field: keyof Quest, val: any) => {
    const newPhases = [...data.phases];
    (newPhases[phaseIdx].quests[questIdx] as any)[field] = val;

    if (field === 'title') {
      const found = exerciseMaster.find(m => m.name === val && m.category === newPhases[phaseIdx].quests[questIdx].type);
      if (found && found.video_url) {
        newPhases[phaseIdx].quests[questIdx].video_url = found.video_url;
      }
    }
    setData({ ...data, phases: newPhases });
  };

  const addQuest = (phaseIdx: number, type: QuestType) => {
    const newPhases = [...data.phases];
    const titles: Record<string, string> = {
      training: "筋力TR", care: "可動域改善", mental: "コンディション入力", cardio: "有酸素", life: "栄養管理"
    };
    newPhases[phaseIdx].quests.push({
      id: Date.now(),
      title: titles[type] || "新規メニュー",
      quantity: "10回",
      sets: "3セット",
      type: type,
      video_url: ""
    });
    setData({ ...data, phases: newPhases });
  };

  const removeQuest = (phaseIdx: number, questIdx: number) => {
    const newPhases = [...data.phases];
    newPhases[phaseIdx].quests.splice(questIdx, 1);
    setData({ ...data, phases: newPhases });
  };

  const addPhase = () => {
    const newPhases = [...data.phases, {
      id: Date.now(), title: `Phase ${data.phases.length + 1}`, description: "", boss: "", quests: []
    }];
    setData({ ...data, phases: newPhases });
    setFocusedPhaseIdx(newPhases.length - 1);
  };

  const removePhase = (idx: number) => {
    if (data.phases.length <= 1) return showToast("最低1つのフェーズが必要です", "error");
    const phase = data.phases[idx];
    if (phase.quests.length > 0) {
      if (!window.confirm(`Phase ${idx + 1} には ${phase.quests.length} 個のクエストがあります。削除しますか？`)) return;
    }
    const newPhases = data.phases.filter((_, i) => i !== idx);
    setData({ ...data, phases: newPhases });
    if (focusedPhaseIdx >= newPhases.length) setFocusedPhaseIdx(newPhases.length - 1);
  };

  const handleSave = async () => {
    if (!data.title) return showToast("プログラム名を入力してください", "error");
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインしてください");

      const allQuestsInAllPhases = data.phases.flatMap(p => p.quests);
      await syncExerciseMaster(user.id, allQuestsInAllPhases);

      let finalTemplateId = templateId;

      if (templateId) {
        await supabase.schema('rehab').from('prescriptions').update({
          title: data.title,
          description: data.description,
          estimated_duration: data.duration,
          body_part_key: data.body_part_key || null,
          phase_details: data.phases.reduce((acc, p, idx) => ({
            ...acc, [idx + 1]: { description: p.description, boss: p.boss }
          }), {})
        }).eq('id', templateId);
        await supabase.schema('rehab').from('prescription_items').delete().eq('prescription_id', templateId);
      } else {
        const { data: presData } = await supabase.schema('rehab').from('prescriptions').insert({
          title: data.title,
          description: data.description,
          trainer_id: user.id,
          type: 'template',
          status: 'active',
          estimated_duration: data.duration,
          body_part_key: data.body_part_key || null,
          phase_details: data.phases.reduce((acc, p, idx) => ({
            ...acc, [idx + 1]: { description: p.description, boss: p.boss }
          }), {})
        }).select().single();
        finalTemplateId = presData.id;
      }

      const itemsToInsert = [];
      for (let pIdx = 0; pIdx < data.phases.length; pIdx++) {
        const phase = data.phases[pIdx];
        for (let qIdx = 0; qIdx < phase.quests.length; qIdx++) {
          const quest = phase.quests[qIdx];
          itemsToInsert.push({
            prescription_id: finalTemplateId,
            name: quest.title,
            quantity: quest.quantity,
            sets: quest.sets,
            phase: pIdx + 1,
            xp: 10,
            icon_type: quest.type,
            video_url: quest.video_url,
            item_index: itemsToInsert.length
          });
        }
      }

      if (itemsToInsert.length > 0) {
        await supabase.schema('rehab').from('prescription_items').insert(itemsToInsert);
      }

      setIsDirty(false);
      showToast("プログラムを保存しました", "success");
      onBack();
    } catch (error: any) { showToast("保存エラー: " + error.message, "error"); } finally { setSubmitting(false); }
  };

  const typeConfig: Record<string, any> = {
    training: { icon: <Activity size={16} />, color: "text-red-500 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800", label: "トレーニング" },
    care: { icon: <Heart size={16} />, color: "text-green-500 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800", label: "ケア・治療" },
    cardio: { icon: <Zap size={16} />, color: "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800", label: "有酸素" },
    mental: { icon: <Brain size={16} />, color: "text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800", label: "メンタル" },
    life: { icon: <Coffee size={16} />, color: "text-yellow-500 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800", label: "生活習慣" },
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-indigo-500 animate-pulse bg-gray-50 dark:bg-gray-900">読み込み中...</div>;

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200 font-sans pb-32 lg:pb-20" onInput={() => setIsDirty(true)}>
      {Object.keys(typeConfig).map(type => (
        <datalist id={`list-${type}`} key={type}>
          {exerciseMaster.filter(m => m.category === type).map((m, i) => <option key={i} value={m.name} />)}
        </datalist>
      ))}

      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-40 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={onBack} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"><ArrowLeft size={20} className="text-gray-400 dark:text-gray-500" /></button>
          <div className="flex-1 max-w-xl">
            <div className="text-xs font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">プログラム作成</div>
            <div className="flex items-center">
              <MapIcon className="mr-2 text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={18} />
              <input
                type="text" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })}
                className="font-black text-lg md:text-xl text-gray-900 dark:text-gray-100 bg-transparent focus:outline-none border-b-2 border-transparent focus:border-indigo-500 transition-all w-full truncate"
                placeholder="プログラム名..."
              />
            </div>
          </div>
        </div>
        <div className="flex w-full md:w-auto justify-end">
          <button onClick={handleSave} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center disabled:opacity-50 w-full md:w-auto justify-center">
            {submitting ? <><span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> 保存中...</> : <><Save size={18} className="mr-2" /> {templateId ? '更新' : '保存'}</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-85px)]">

        {/* スマホ用：フェーズ選択バー（横スクロール） */}
        <div className="lg:hidden sticky top-[85px] z-30 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex items-center gap-2 p-3 no-scrollbar">
          {data.phases.map((phase, idx) => (
            <button
              key={phase.id}
              onClick={() => setFocusedPhaseIdx(idx)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-all whitespace-nowrap ${
                focusedPhaseIdx === idx
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
              }`}
            >
              Phase {idx + 1}
            </button>
          ))}
          <button onClick={addPhase} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 border border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-500">
            <Plus size={16} />
          </button>
        </div>

        {/* スマホ用：概要エリア（アコーディオン） */}
        <div className="lg:hidden px-4 pt-4">
          <button
            onClick={() => setShowMobileInfo(!showMobileInfo)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-300"
          >
            <span className="flex items-center gap-2"><Settings size={14} /> シナリオ設定（概要・期間）</span>
            {showMobileInfo ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {showMobileInfo && (
            <div className="mt-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 block uppercase mb-2 tracking-widest">プログラム概要</label>
              <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-xs font-bold text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none h-24 mb-3" placeholder="このリハビリの狙い..." />
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">期間:</span>
                <input type="text" value={data.duration} onChange={(e) => setData({ ...data, duration: e.target.value })} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs font-black text-indigo-600 dark:text-indigo-400 w-24" />
              </div>
            </div>
          )}
        </div>

        {/* PC用サイドバー（フェーズ一覧・概要） */}
        <div className="hidden lg:block lg:w-[320px] bg-white dark:bg-gray-800 p-6 overflow-y-auto border-r border-gray-100 dark:border-gray-700 flex-shrink-0 h-full">
          <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 mb-8">
            <label className="text-xs font-black text-gray-400 dark:text-gray-500 block uppercase mb-3 tracking-widest">プログラム概要</label>
            <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} className="w-full bg-transparent text-xs font-bold border-none focus:ring-0 resize-none h-28 text-gray-600 dark:text-gray-300 leading-relaxed" placeholder="プログラムの目的..." />
            <div className="mt-4 flex items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
              <Clock size={12} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">期間:</span>
              <input type="text" value={data.duration} onChange={(e) => setData({ ...data, duration: e.target.value })} className="bg-transparent text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none w-full" />
            </div>

            {/* 部位選択 */}
            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1 mb-2"><MapPin size={12} /> 対象部位</label>
              <select value={data.body_part_key} onChange={(e) => setData({ ...data, body_part_key: e.target.value })} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none">
                <option value="">未設定</option>
                {BODY_PART_OPTIONS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map(item => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2"><Layers size={14} /> Phases</h3>
            <button onClick={addPhase} className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><Plus size={16} /></button>
          </div>

          <div className="space-y-3 relative pb-10">
            <div className="absolute left-6 top-8 bottom-8 w-1 bg-gray-100 dark:bg-gray-700 -z-0"></div>
            {data.phases.map((phase, idx) => (
              <div key={phase.id} className="relative">
                <button onClick={() => setFocusedPhaseIdx(idx)} className={`w-full text-left relative flex items-start p-4 rounded-2xl transition-all border-2 z-10 ${focusedPhaseIdx === idx ? 'bg-white dark:bg-gray-800 border-indigo-600 shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20' : 'bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-gray-400 dark:text-gray-500'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm mr-3 border-2 ${focusedPhaseIdx === idx ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-300 dark:text-gray-500 border-gray-100 dark:border-gray-600'}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black uppercase opacity-60 leading-none mb-1">Phase {idx + 1}</div>
                    <div className={`font-black text-sm truncate ${focusedPhaseIdx === idx ? 'text-gray-900 dark:text-gray-100' : ''}`}>{phase.title || "無題"}</div>
                  </div>
                </button>
                {data.phases.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); removePhase(idx); }} className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center z-20 hover:bg-rose-600 shadow"><X size={12} /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* メイン詳細エディタ */}
        <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto p-4 md:p-8 h-full">
          {data.phases[focusedPhaseIdx] && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">

              {/* フェーズ設定カード */}
              <div className="bg-white dark:bg-gray-800 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded flex-shrink-0 w-fit">フェーズ設定</span>
                      <input type="text" value={data.phases[focusedPhaseIdx].title} onChange={(e) => updatePhase(focusedPhaseIdx, 'title', e.target.value)} className="text-xl md:text-2xl font-black text-gray-900 dark:text-gray-100 focus:outline-none border-b-2 border-transparent focus:border-indigo-100 dark:focus:border-indigo-800 w-full bg-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block px-1 flex items-center gap-2"><Info size={14} className="text-indigo-400" /> フェーズ詳細</label>
                      <textarea value={data.phases[focusedPhaseIdx].description} onChange={(e) => updatePhase(focusedPhaseIdx, 'description', e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-2xl p-4 text-sm font-bold text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none h-28 transition-all leading-relaxed" placeholder="このフェーズの狙いを入力..." />
                    </div>
                  </div>
                  <div className="md:w-64 space-y-3 flex-shrink-0">
                    <label className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-2 px-1"><Sword size={14} /> フェーズ移行条件</label>
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-800 rounded-xl p-5 text-center shadow-inner">
                      <Trophy size={24} className="mx-auto mb-3 text-red-500 opacity-40" />
                      <input type="text" value={data.phases[focusedPhaseIdx].boss} onChange={(e) => updatePhase(focusedPhaseIdx, 'boss', e.target.value)} className="bg-transparent text-xs font-black text-red-700 dark:text-red-400 w-full text-center focus:outline-none placeholder:text-red-300 dark:placeholder:text-red-700" placeholder="次フェーズへの移行条件..." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 px-2 text-lg uppercase tracking-tight"><Shield size={20} className="text-indigo-600 dark:text-indigo-400" /> デイリーメニュー</h4>

                {/* 種類選択ボタン */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <button key={key} onClick={() => addQuest(focusedPhaseIdx, key as QuestType)} className={`flex items-center md:flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg transition-all active:scale-95 group`}>
                      <div className={`p-2 rounded-xl ${config.color} flex-shrink-0`}>{config.icon}</div>
                      <span className="text-xs font-black text-gray-700 dark:text-gray-300 truncate">{config.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {data.phases[focusedPhaseIdx].quests.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-12 md:p-24 text-center opacity-30">
                      <Dumbbell size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" /><p className="text-xs font-black uppercase tracking-widest">メニューなし</p>
                    </div>
                  ) : (
                    data.phases[focusedPhaseIdx].quests.map((quest, qIdx) => (
                      <div key={quest.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 md:p-7 shadow-sm group relative animate-slide-up flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                          <div className={`w-12 h-12 md:w-14 md:h-14 flex-shrink-0 flex items-center justify-center rounded-2xl shadow-sm ${typeConfig[quest.type].color}`}>{typeConfig[quest.type].icon}</div>

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5 w-full">
                            <div className="md:col-span-6">
                              <label className="text-xs text-gray-400 dark:text-gray-500 font-black uppercase mb-1 px-1 block tracking-widest">種目名</label>
                              <input type="text" list={`list-${quest.type}`} value={quest.title} onChange={(e) => updateQuest(focusedPhaseIdx, qIdx, 'title', e.target.value)} className="w-full font-black text-gray-800 dark:text-gray-200 border-none bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 md:py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all shadow-inner" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 md:col-span-6">
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-500 font-black uppercase mb-1 px-1 block tracking-widest">回数</label>
                                <input type="text" value={quest.quantity} onChange={(e) => updateQuest(focusedPhaseIdx, qIdx, 'quantity', e.target.value)} className="w-full text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 md:py-2.5 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 shadow-inner" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 dark:text-gray-500 font-black uppercase mb-1 px-1 block tracking-widest">セット</label>
                                <input type="text" value={quest.sets} onChange={(e) => updateQuest(focusedPhaseIdx, qIdx, 'sets', e.target.value)} className="w-full text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 md:py-2.5 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 shadow-inner" />
                              </div>
                            </div>

                            <div className="md:col-span-12">
                              <label className="text-xs text-gray-400 dark:text-gray-500 font-black uppercase mb-1 px-1 block flex items-center gap-1">
                                <Youtube size={12} className="text-red-500" /> YouTube動画URL
                              </label>
                              <input
                                type="text"
                                value={quest.video_url || ""}
                                onChange={(e) => updateQuest(focusedPhaseIdx, qIdx, 'video_url', e.target.value)}
                                placeholder="URLを貼り付け..."
                                className="w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 md:py-2.5 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all shadow-inner"
                              />
                            </div>
                          </div>
                        </div>

                        {getYoutubeId(quest.video_url || "") && (
                          <div className="w-full aspect-video rounded-3xl overflow-hidden border-4 border-gray-50 dark:border-gray-700 bg-black shadow-2xl">
                            <iframe
                              width="100%" height="100%"
                              src={`https://www.youtube.com/embed/${getYoutubeId(quest.video_url || "")}?rel=0&modestbranding=1`}
                              title="Preview" frameBorder="0" allowFullScreen
                            ></iframe>
                          </div>
                        )}

                        <button onClick={() => removeQuest(focusedPhaseIdx, qIdx)} className="absolute top-4 right-4 md:top-5 md:right-5 text-gray-200 dark:text-gray-600 hover:text-red-500 transition-colors p-2"><X size={20} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
