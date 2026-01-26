import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Sword, Activity, Youtube, CheckCircle2, AlertCircle, 
  Trophy, ChevronLeft, Star, Zap, Play, Info, Lock, ChevronRight,
  Stethoscope, Flame, Eye
} from 'lucide-react';

interface RehabQuestViewProps {
  userId: string;
  onBackHome: () => void;
}

export default function RehabQuestView({ userId, onBackHome }: RehabQuestViewProps) {
  const [quest, setQuest] = useState<any>(null);
  const [injury, setInjury] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [latestLog, setLatestLog] = useState<any>(null);
  const [rewardMsg, setRewardMsg] = useState<{show: boolean, text: string}>({show: false, text: ''});
  const [selectedNrs, setSelectedNrs] = useState<number | null>(null);
  
  // ★ 閲覧中のフェーズ（初期値は現在のフェーズ）
  const [viewingPhase, setViewingPhase] = useState<number>(1);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data: injuryData } = await supabase
        .schema('rehab')
        .from('injuries')
        .select('*')
        .eq('athlete_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      setInjury(injuryData);

      const { data: prescription } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select(`*, items:prescription_items(*)`)
        .eq('athlete_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (prescription) {
        setQuest(prescription);
        setViewingPhase(prescription.current_phase); // 閲覧初期値をセット
        const { data: log } = await supabase
          .schema('rehab')
          .from('prescription_daily_logs')
          .select('*')
          .eq('prescription_id', prescription.id)
          .eq('log_date', today)
          .maybeSingle();
        setLatestLog(log);
        if (log) setSelectedNrs(log.pain_level);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cycleExerciseStatus = async (itemId: string) => {
    if (!quest || viewingPhase !== quest.current_phase) return; // 現在のフェーズ以外は操作不可
    const today = new Date().toISOString().split('T')[0];
    const currentResults = latestLog?.item_results || {};
    const status = currentResults[itemId] || 'none';

    let nextStatus: 'none' | 'done' | 'pain';
    if (status === 'none') nextStatus = 'done';
    else if (status === 'done') nextStatus = 'pain';
    else nextStatus = 'none';

    const newResults = { ...currentResults, [itemId]: nextStatus };

    try {
      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        item_results: newResults,
        completed_items: Object.keys(newResults).filter(k => newResults[k] !== 'none'),
        pain_level: selectedNrs || 0
      }, { onConflict: 'prescription_id, log_date' });
      
      setLatestLog((prev: any) => ({ ...prev, item_results: newResults }));
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const finalizeRehab = async () => {
    if (!quest || selectedNrs === null) {
      alert("現在の痛みレベルを選択してください");
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        pain_level: selectedNrs,
        item_results: latestLog?.item_results || {}
      }, { onConflict: 'prescription_id, log_date' });

      const { data: result } = await supabase.rpc('reward_rehab_action', {
        p_user_id: userId,
        p_action_type: 'nrs_log'
      });

      setRewardMsg({ 
        show: true, 
        text: result?.badge_unlocked ? "リハビリ完了！バッジ獲得！ ＋10pt" : "リハビリ報告完了！ ＋10pt" 
      });
      setTimeout(() => {
        setRewardMsg({show: false, text: ''});
        onBackHome();
      }, 2500);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) return <div className="p-10 text-center text-blue-600 font-black animate-pulse">リハビリデータを読込中...</div>;

  const isCurrentViewActive = viewingPhase === quest?.current_phase;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-slate-900 dark:text-white">
      
      {/* 報酬演出 */}
      {rewardMsg.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="bg-blue-600 p-8 rounded-[3rem] text-center shadow-2xl border-4 border-blue-400 animate-bounce mx-4">
            <Trophy size={64} className="mx-auto text-yellow-400 mb-4" />
            <h2 className="text-2xl font-black text-white">{rewardMsg.text}</h2>
          </div>
        </div>
      )}

      <button onClick={onBackHome} className="flex items-center text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest hover:text-blue-600 transition-colors">
        <ChevronLeft size={16} className="mr-1" /> ホームへ戻る
      </button>

      {/* 1. 怪我診断情報セクション */}
      <section className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-500/20 rounded-xl text-red-500"><Stethoscope size={20}/></div>
          <h3 className="font-black text-sm uppercase tracking-tighter text-slate-500 dark:text-slate-300">Medical Status</h3>
        </div>
        <div className="space-y-2">
          <div className="text-xl font-black">{injury?.diagnosis || '診断名未設定'}</div>
          <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>受傷日: {injury?.injury_date}</span>
            <span className="text-blue-600 font-black">● 治療継続中</span>
          </div>
        </div>
      </section>

      {/* 2. フェーズ・ロードマップ（タップで切り替え） */}
      <section className="px-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
            <Zap size={14} className="text-yellow-500" /> Rehab Roadmap
          </div>
          <span className="text-[9px] font-bold text-slate-400">番号をタップして内容を確認</span>
        </div>
        <div className="flex justify-between items-center gap-1">
          {[1, 2, 3, 4, 5].map((p) => {
            const isTarget = quest?.current_phase === p;
            const isViewing = viewingPhase === p;
            const isCleared = quest?.current_phase > p;

            return (
              <button 
                key={p} 
                onClick={() => setViewingPhase(p)}
                className="flex-1 flex flex-col items-center gap-2 outline-none group"
              >
                <div className={`w-full h-1.5 rounded-full transition-colors ${isCleared ? 'bg-blue-500' : isTarget ? 'bg-blue-400 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isViewing 
                    ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/30 scale-110' 
                    : isCleared ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {quest?.current_phase < p ? <Lock size={14} className={isViewing ? 'text-white' : 'text-slate-300'} /> : <span className="text-xs font-black italic">P{p}</span>}
                  {isTarget && <Star size={10} className="absolute -top-1 -right-1 text-yellow-400 fill-yellow-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. リハビリメニューリスト */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Sword size={14} className="text-blue-600" /> Phase {viewingPhase} のメニュー
          </h3>
          {!isCurrentViewActive && (
             <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
               <Lock size={10} /> 閲覧のみ
             </span>
          )}
        </div>

        <div className="space-y-3">
          {quest?.items?.filter((i:any) => i.phase === viewingPhase).length > 0 ? (
            quest.items.filter((i:any) => i.phase === viewingPhase).map((item: any) => {
              const status = isCurrentViewActive ? (latestLog?.item_results?.[item.id] || 'none') : 'none';
              const ytId = item.video_url ? getYoutubeId(item.video_url) : null;

              return (
                <div key={item.id} className={`group rounded-[1.8rem] border-2 transition-all duration-300 ${
                  status === 'done' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/50' : 
                  status === 'pain' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/50' : 
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'
                } ${!isCurrentViewActive && 'opacity-70'}`}>
                  <div className="p-5 flex items-center gap-4">
                    <button 
                      onClick={() => cycleExerciseStatus(item.id)}
                      disabled={!isCurrentViewActive}
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        !isCurrentViewActive ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500' :
                        status === 'done' ? 'bg-green-500 text-white shadow-lg' : 
                        status === 'pain' ? 'bg-orange-500 text-white shadow-lg' : 
                        'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200'
                      } active:scale-90`}
                    >
                      {status === 'done' && <CheckCircle2 size={24} />}
                      {status === 'pain' && <AlertCircle size={24} />}
                      {status === 'none' && (isCurrentViewActive ? <Play size={22} fill="currentColor" /> : <Eye size={22} />)}
                      <span className="text-[8px] font-black uppercase mt-1">
                        {status === 'done' ? 'CLEAR' : status === 'pain' ? 'PAIN' : isCurrentViewActive ? 'START' : 'VIEW'}
                      </span>
                    </button>

                    <div className="flex-1" onClick={() => cycleExerciseStatus(item.id)}>
                      <h4 className={`font-black text-base ${status !== 'none' ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{item.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {item.quantity} {item.sets && `× ${item.sets} Sets`} / <span className="text-blue-600 dark:text-blue-400">+{item.xp || 10} XP</span>
                      </p>
                    </div>

                    {ytId && (
                      <button 
                        onClick={() => setActiveVideo(activeVideo === item.id ? null : item.id)}
                        className={`p-3 rounded-2xl transition-all ${activeVideo === item.id ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-slate-700 text-red-500'}`}
                      >
                        <Play size={18} fill={activeVideo === item.id ? 'white' : 'none'} />
                      </button>
                    )}
                  </div>

                  {activeVideo === item.id && ytId && (
                    <div className="px-5 pb-5 animate-in zoom-in-95 duration-300">
                      <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-700">
                        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`} frameBorder="0" allowFullScreen />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Lock className="mx-auto text-slate-300 mb-2" size={24} />
              <p className="text-xs font-bold text-slate-400 uppercase">このフェーズのメニューは未設定です</p>
            </div>
          )}
        </div>
      </section>

      {/* 4. 本日の体調報告 & リハビリ完了（現在のフェーズを表示している時のみ有効） */}
      {isCurrentViewActive && (
        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-blue-500/20 dark:border-blue-500/30 text-center shadow-xl">
          <div className="bg-blue-50 dark:bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
          <h3 className="text-lg font-black mb-1 uppercase tracking-tight">Daily Report</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-8">リハビリ後の痛みを選択して完了</p>
          
          <div className="grid grid-cols-6 gap-2 mb-10">
            {[...Array(11).keys()].map(val => (
              <button 
                key={val}
                onClick={() => setSelectedNrs(val)}
                className={`h-12 rounded-xl font-black text-sm transition-all active:scale-90 ${
                  selectedNrs === val 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-500/20 scale-110 z-10' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {val}
              </button>
            ))}
            <div className="flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">NRS</div>
          </div>
          
          <button 
            onClick={finalizeRehab}
            disabled={selectedNrs === null}
            className={`w-full py-5 rounded-[1.5rem] font-black text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
              selectedNrs !== null 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-500/40' 
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 grayscale opacity-50'
            }`}
          >
            <Flame size={20} />
            本日のリハビリを完了する
          </button>
        </section>
      )}

      {/* 応援アドバイス */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 rounded-3xl p-6 flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <Info size={24} />
        </div>
        <div>
          <h5 className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase mb-1">Medical Advice</h5>
          <p className="text-xs text-slate-600 dark:text-blue-200/80 font-bold leading-relaxed italic">
            「痛みは身体が発するシグナル。無理をしてフェーズを急ぐより、着実にこなすことが完全復帰への近道だぞ。」
          </p>
        </div>
      </div>
    </div>
  );
}