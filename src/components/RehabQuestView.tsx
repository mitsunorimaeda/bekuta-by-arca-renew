import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Sword, Activity, Youtube, CheckCircle2, AlertCircle, 
  Trophy, ChevronLeft, Star, Zap, Play, Info
} from 'lucide-react';

interface RehabQuestViewProps {
  userId: string;
  onBackHome: () => void;
}

export default function RehabQuestView({ userId, onBackHome }: RehabQuestViewProps) {
  const [quest, setQuest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [latestLog, setLatestLog] = useState<any>(null);
  const [rewardMsg, setRewardMsg] = useState<{show: boolean, text: string}>({show: false, text: ''});

  useEffect(() => {
    fetchQuestData();
  }, [userId]);

  const fetchQuestData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 1. アクティブな処方を取得
      const { data: prescription } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select(`*, items:prescription_items(*)`)
        .eq('athlete_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (prescription) {
        // 現在のフェーズのアイテムのみ抽出
        const todayItems = prescription.items.filter((i: any) => i.phase === prescription.current_phase);
        setQuest({ ...prescription, items: todayItems });

        // 今日のログ（実施状況）を取得
        const { data: log } = await supabase
          .schema('rehab')
          .from('prescription_daily_logs')
          .select('*')
          .eq('prescription_id', prescription.id)
          .eq('log_date', today)
          .maybeSingle();
        setLatestLog(log);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 修行（メニュー）のトグル処理
  const toggleExercise = async (itemId: string) => {
    if (!quest) return;
    const today = new Date().toISOString().split('T')[0];
    const currentResults = latestLog?.item_results || {};
    const nextStatus = currentResults[itemId] === 'done' ? 'none' : 'done';
    const newResults = { ...currentResults, [itemId]: nextStatus };

    try {
      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        item_results: newResults,
        completed_items: Object.keys(newResults).filter(k => newResults[k] === 'done'),
        pain_level: latestLog?.pain_level || 0
      }, { onConflict: 'prescription_id, log_date' });
      
      setLatestLog((prev: any) => ({ ...prev, item_results: newResults }));
    } catch (e: any) {
      alert(e.message);
    }
  };

  // NRS回答と報酬獲得処理
  const submitDailyReport = async (nrs: number) => {
    if (!quest) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. NRSをログに保存
      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        pain_level: nrs,
        item_results: latestLog?.item_results || {}
      }, { onConflict: 'prescription_id, log_date' });

      // 2. 報酬処理 (RPC呼び出し)
      const { data: result } = await supabase.rpc('reward_rehab_action', {
        p_user_id: userId,
        p_action_type: 'nrs_log'
      });

      // 3. 演出表示
      setRewardMsg({ 
        show: true, 
        text: result?.badge_unlocked ? "バッジ獲得！ ＋10pt" : "報告完了！ ＋10pt" 
      });
      setTimeout(() => setRewardMsg({show: false, text: ''}), 3000);
      
      fetchQuestData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) return <div className="p-10 text-center text-indigo-400 font-black animate-pulse">LOADING QUEST...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* ナビゲーション */}
      <button onClick={onBackHome} className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
        <ChevronLeft size={16} className="mr-1" /> Back to Home
      </button>

      {/* 報酬獲得ポップアップ */}
      {rewardMsg.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-full font-black shadow-2xl animate-bounce border-2 border-white">
          ✨ {rewardMsg.text}
        </div>
      )}

      {/* ステータスヘッダー */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
        <Zap className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Active Recovery</span>
            <Trophy size={20} className="text-yellow-300" />
          </div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Phase {quest?.current_phase || 1}</h2>
          <p className="text-white/70 text-xs font-bold">{quest?.title || '修行メニューが未設定です'}</p>
        </div>
      </div>

      {/* 修行リスト */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Sword size={14} /> Today's Missions
          </h3>
          <span className="text-[10px] font-bold text-slate-500">{quest?.items.length || 0} ITEMS</span>
        </div>

        <div className="space-y-3">
          {quest?.items.map((item: any) => {
            const isDone = latestLog?.item_results?.[item.id] === 'done';
            const ytId = item.video_url ? getYoutubeId(item.video_url) : null;

            return (
              <div key={item.id} className={`group transition-all duration-300 rounded-[1.5rem] border ${isDone ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'} shadow-sm`}>
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1" onClick={() => toggleExercise(item.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        {isDone ? <CheckCircle2 className="text-indigo-400" size={18} /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 dark:border-slate-600" />}
                        <h4 className={`font-black text-sm transition-colors ${isDone ? 'text-indigo-300 line-through opacity-60' : 'text-slate-800 dark:text-white'}`}>
                          {item.name}
                        </h4>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter pl-6">
                        {item.quantity} {item.sets && `× ${item.sets} Sets`} / +{item.xp || 10} XP
                      </p>
                    </div>
                    
                    {ytId && (
                      <button 
                        onClick={() => setActiveVideo(activeVideo === item.id ? null : item.id)}
                        className={`p-2 rounded-xl transition-all ${activeVideo === item.id ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}
                      >
                        <Play size={16} fill={activeVideo === item.id ? 'white' : 'none'} />
                      </button>
                    )}
                  </div>

                  {/* YouTube Embed */}
                  {activeVideo === item.id && ytId && (
                    <div className="mt-4 animate-in zoom-in-95 duration-300">
                      <div className="aspect-video rounded-xl overflow-hidden bg-black border border-slate-700">
                        <iframe 
                          width="100%" height="100%" 
                          src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`} 
                          frameBorder="0" allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 本日の体調報告セクション */}
      <section className="bg-slate-800 dark:bg-slate-900 rounded-[2rem] p-8 border-2 border-dashed border-indigo-500/30 text-center">
        <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="text-indigo-400" size={32} />
        </div>
        <h3 className="text-lg font-black text-white mb-1 uppercase tracking-tight">Condition Report</h3>
        <p className="text-slate-400 text-xs font-bold mb-6">修行後の痛みを報告して 10pt 獲得しよう</p>
        
        <div className="grid grid-cols-6 gap-2 max-w-xs mx-auto mb-6">
          {[0, 2, 4, 6, 8, 10].map(val => (
            <button 
              key={val}
              onClick={() => submitDailyReport(val)}
              className={`h-10 rounded-xl font-black text-xs transition-all active:scale-90 ${latestLog?.pain_level === val ? 'bg-indigo-600 text-white ring-2 ring-white/20' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {val}
            </button>
          ))}
        </div>
        
        <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          <Info size={12} /> 0: Good / 10: Heavy Pain
        </div>
      </section>

      {/* 豆知識カード */}
      <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-4">
        <Star className="text-indigo-400 flex-shrink-0" size={20} />
        <p className="text-xs text-indigo-300/80 font-bold leading-relaxed italic">
          「焦らず、一歩ずつ進むことが最強への近道だ。痛みがある時は無理せずトレーナーに相談しよう。」
        </p>
      </div>
    </div>
  );
}