import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Sword, Activity, CheckCircle2, AlertCircle, 
  Trophy, ChevronLeft, Star, Zap, Play, Info, Lock, 
  Stethoscope, Flame, Eye 
} from 'lucide-react';

// バッジコントローラー
import { BadgeModalController } from './BadgeModalController';

interface RehabQuestViewProps {
  userId: string;
  prescriptionId?: string;  // 指定時はこの処方を直接表示
  onBackHome: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function RehabQuestView({ userId, prescriptionId: propPrescriptionId, onBackHome }: RehabQuestViewProps) {
  const [quest, setQuest] = useState<any>(null);

  // ★ 変更: 単体ではなくリストも管理する
  const [injuryList, setInjuryList] = useState<any[]>([]);
  const [injury, setInjury] = useState<any>(null); // 現在表示中の怪我

  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [latestLog, setLatestLog] = useState<any>(null);
  const [rewardMsg, setRewardMsg] = useState<{show: boolean, text: string}>({show: false, text: ''});
  const [selectedNrs, setSelectedNrs] = useState<number | null>(null);
  const [selectedRpe, setSelectedRpe] = useState<number | null>(null);
  const [viewingPhase, setViewingPhase] = useState<number>(1);

  // ウェイト入力用 state: { [itemId]: { sets: [{ weight, reps }] } }
  const [weightInputs, setWeightInputs] = useState<Record<string, { weight: number; reps: number }[]>>({});

  // YouTubeプレーヤー制御用
  const playerRef = useRef<any>(null);
  const trackingIntervalRef = useRef<any>(null);
  const milestonesReachedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
    loadYouTubeAPI();
  }, [userId]);

  // --- YouTube API 制御 ---
  const loadYouTubeAPI = () => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  };

  // 視聴進捗を記録する関数
  const logVideoProgress = (itemId: string, percentage: number) => {
    console.log(`[Video Tracking] Item: ${itemId}, Progress: ${percentage}%`);
  };

  // 定期的に再生位置をチェックする関数
  const startTracking = (player: any, itemId: string) => {
    stopTracking(); 
    milestonesReachedRef.current.clear(); 

    trackingIntervalRef.current = setInterval(() => {
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();

      if (duration > 0) {
        const percent = (currentTime / duration) * 100;
        const milestones = [25, 50, 75, 100];

        milestones.forEach(m => {
          if (!milestonesReachedRef.current.has(m) && percent >= m) {
            milestonesReachedRef.current.add(m);
            logVideoProgress(itemId, m);
          }
        });
      }
    }, 1000); 
  };

  const stopTracking = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (activeVideo && window.YT && window.YT.Player) {
      const item = quest?.items?.find((i: any) => i.id === activeVideo);
      const ytid = getYoutubeId(item?.video_url || '');
      
      if (ytid) {
        if (playerRef.current) {
          playerRef.current.destroy();
        }

        playerRef.current = new window.YT.Player(`yt-player-${activeVideo}`, {
          videoId: ytid,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: 1 },
          events: {
            'onStateChange': (e: any) => {
              if (e.data === 1) {
                startTracking(e.target, activeVideo);
              } else {
                stopTracking();
              }
            }
          }
        });
      }
    }

    return () => {
      stopTracking();
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [activeVideo]);

  // --- データ取得 ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // ★ 修正: リストとして取得し、maybeSingleを使わない
      const { data: injuryDataList } = await supabase
        .schema('rehab')
        .from('injuries')
        .select('*')
        .eq('athlete_user_id', userId)
        .in('status', ['active', 'conditioning'])
        .order('created_at', { ascending: false }); // 新しい順
      
      if (injuryDataList && injuryDataList.length > 0) {
        setInjuryList(injuryDataList);
        setInjury(injuryDataList[0]); // デフォルトで最新のものを表示
      }

      // prescriptionId が指定されている場合はそれを直接取得、なければ従来通り
      let prescription: any = null;
      if (propPrescriptionId) {
        const { data } = await supabase
          .schema('rehab')
          .from('prescriptions')
          .select(`*, items:prescription_items(*)`)
          .eq('id', propPrescriptionId)
          .single();
        prescription = data;
      } else {
        const { data } = await supabase
          .schema('rehab')
          .from('prescriptions')
          .select(`*, items:prescription_items(*)`)
          .eq('athlete_user_id', userId)
          .in('status', ['active', 'conditioning'])
          .limit(1)
          .maybeSingle();
        prescription = data;
      }

      if (prescription) {
        setQuest(prescription);
        setViewingPhase(prescription.current_phase);

        // ウェイト入力の初期化
        const weightItems = (prescription.items || []).filter((i: any) => i.input_type === 'weight');
        const initialWeightInputs: Record<string, { weight: number; reps: number }[]> = {};
        weightItems.forEach((item: any) => {
          const setCount = parseInt(item.sets) || 3;
          initialWeightInputs[item.id] = Array.from({ length: setCount }, () => ({ weight: 0, reps: 0 }));
        });
        setWeightInputs(initialWeightInputs);
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
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const updateExerciseStatus = async (itemId: string, nextStatus: 'none' | 'done' | 'pain', weightData?: { weight: number; reps: number }[]) => {
    const today = new Date().toISOString().split('T')[0];
    const currentResults = latestLog?.item_results || {};

    // ウェイトデータがある場合はオブジェクト形式、それ以外は文字列（後方互換）
    const newValue = weightData
      ? { status: nextStatus, sets: weightData }
      : nextStatus;

    const newResults = { ...currentResults, [itemId]: newValue };

    try {
      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        item_results: newResults,
        completed_items: Object.keys(newResults).filter(k => {
          const val = newResults[k];
          const status = typeof val === 'string' ? val : val?.status;
          return status !== 'none';
        }),
        pain_level: selectedNrs || 0,
        rpe: selectedRpe || null,
      }, { onConflict: 'prescription_id, log_date' });

      setLatestLog((prev: any) => ({ ...prev, item_results: newResults }));
    } catch (e: any) { console.error(e.message); }
  };

  const getStatusFromResult = (result: any): string => {
    if (!result) return 'none';
    if (typeof result === 'string') return result;
    return result.status || 'none';
  };

  const cycleExerciseStatus = (itemId: string) => {
    if (!quest || viewingPhase !== quest.current_phase) return;
    const currentResults = latestLog?.item_results || {};
    const status = getStatusFromResult(currentResults[itemId]);

    let nextStatus: 'none' | 'done' | 'pain';
    if (status === 'none') nextStatus = 'done';
    else if (status === 'done') nextStatus = 'pain';
    else nextStatus = 'none';

    updateExerciseStatus(itemId, nextStatus);
  };

  // ウェイト入力のセットデータ更新
  const updateWeightSet = (itemId: string, setIndex: number, field: 'weight' | 'reps', value: number) => {
    setWeightInputs(prev => {
      const sets = [...(prev[itemId] || [])];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      return { ...prev, [itemId]: sets };
    });
  };

  // ウェイト種目の完了記録
  const completeWeightExercise = (itemId: string) => {
    const sets = weightInputs[itemId];
    if (!sets || sets.every(s => s.weight === 0 && s.reps === 0)) return;
    updateExerciseStatus(itemId, 'done', sets);
  };

  const isRehab = quest?.purpose === 'rehab' || !quest?.purpose;
  const metricValue = isRehab ? selectedNrs : selectedRpe;

  const finalizeRehab = async () => {
    if (!quest || metricValue === null) {
      alert(isRehab ? "現在の痛みレベルを選択してください" : "運動強度（RPE）を選択してください");
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];

      await supabase.schema('rehab').from('prescription_daily_logs').upsert({
        prescription_id: quest.id,
        athlete_user_id: userId,
        log_date: today,
        pain_level: isRehab ? metricValue : 0,
        rpe: !isRehab ? metricValue : null,
        item_results: latestLog?.item_results || {}
      }, { onConflict: 'prescription_id, log_date' });

      try {
        await supabase.rpc('reward_rehab_action', {
          p_user_id: userId,
          p_action_type: 'nrs_log'
        });
      } catch (_) { /* reward RPCが無くても処理は続行 */ }

      setRewardMsg({
        show: true,
        text: isRehab ? "リハビリ報告完了！" : "トレーニング報告完了！"
      });

      setTimeout(() => {
        setRewardMsg({show: false, text: ''});
        onBackHome();
      }, 2500);

    } catch (e: any) { alert(e.message); }
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
      
      <BadgeModalController userId={userId} />

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

      {/* ★ 追加：怪我が複数ある場合の切り替えタブ */}
      {injuryList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {injuryList.map((item) => (
            <button
              key={item.id}
              onClick={() => setInjury(item)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                injury?.id === item.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.status === 'conditioning' ? 'bg-orange-400' : 'bg-red-500'}`} />
              {item.diagnosis}
            </button>
          ))}
        </div>
      )}

      {/* 1. 怪我診断情報 */}
      <section className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-500/20 rounded-xl text-red-500"><Stethoscope size={20}/></div>
          <h3 className="font-black text-sm uppercase tracking-tighter text-slate-500 dark:text-slate-300">Medical Status</h3>
        </div>
        <div className="space-y-2">
          <div className="text-xl font-black">{injury?.diagnosis || '診断名未設定'}</div>
          <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>受傷日: {injury?.injury_date}</span>
            <span className={`font-black ${injury?.status === 'conditioning' ? 'text-orange-500' : 'text-blue-600'}`}>
              {injury?.status === 'conditioning' ? '● コンディショニング' : '● 治療継続中'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. フェーズ・ロードマップ */}
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
              <button key={p} onClick={() => setViewingPhase(p)} className="flex-1 flex flex-col items-center gap-2 outline-none group">
                <div className={`w-full h-1.5 rounded-full transition-colors ${isCleared ? 'bg-blue-500' : isTarget ? 'bg-blue-400 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isViewing ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/30 scale-110' : isCleared ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
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
          {!isCurrentViewActive && <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg"><Lock size={10} /> 閲覧のみ</span>}
        </div>

        <div className="space-y-3">
          {quest?.items?.filter((i:any) => i.phase === viewingPhase).length > 0 ? (
            quest.items.filter((i:any) => i.phase === viewingPhase).map((item: any) => {
              const resultVal = latestLog?.item_results?.[item.id];
              const status = isCurrentViewActive ? getStatusFromResult(resultVal) : 'none';
              const ytId = item.video_url ? getYoutubeId(item.video_url) : null;
              const isWeightType = item.input_type === 'weight';

              return (
                <div key={item.id} className={`group rounded-[1.8rem] border-2 transition-all duration-300 ${
                  status === 'done' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/50' :
                  status === 'pain' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/50' :
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'
                } ${!isCurrentViewActive && 'opacity-70'}`}>
                  <div className="p-5 flex items-center gap-4">
                    {/* 左側のステータスボタン */}
                    {!isWeightType ? (
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
                    ) : (
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${
                        status === 'done' ? 'bg-green-500 text-white' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'
                      }`}>
                        {status === 'done' ? <CheckCircle2 size={24} /> : <Sword size={20} />}
                        <span className="text-[7px] font-black uppercase mt-0.5">
                          {status === 'done' ? 'DONE' : 'WEIGHT'}
                        </span>
                      </div>
                    )}

                    <div className="flex-1" onClick={() => !isWeightType && cycleExerciseStatus(item.id)}>
                      <h4 className={`font-black text-base ${status !== 'none' ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{item.name}</h4>
                      {isWeightType ? (
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">
                          {item.intensity && `${item.intensity} `}
                          {item.rep_range && `(${item.rep_range}rep) `}
                          {item.target_rpe && `RPE${item.target_rpe} `}
                          {item.tempo && `T:${item.tempo} `}
                          {item.rest_seconds && `REST${item.rest_seconds}s`}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {item.quantity} {item.sets && `× ${item.sets} Sets`}
                        </p>
                      )}
                    </div>

                    {ytId && (
                      <button
                        onClick={() => setActiveVideo(activeVideo === item.id ? null : item.id)}
                        className={`p-3 rounded-2xl transition-all ${activeVideo === item.id ? 'bg-red-500 text-white shadow-lg' : 'bg-red-50 dark:bg-slate-700 text-red-500'}`}
                      >
                        <Play size={18} fill={activeVideo === item.id ? 'white' : 'none'} />
                      </button>
                    )}
                  </div>

                  {/* ウェイト入力エリア */}
                  {isWeightType && isCurrentViewActive && status !== 'done' && (
                    <div className="px-5 pb-5 space-y-2">
                      {item.sub_exercise && (
                        <div className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                          💡 REST中: {item.sub_exercise}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {(weightInputs[item.id] || []).map((set, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl px-3 py-2">
                            <span className="text-[10px] font-black text-gray-400 w-8">S{sIdx + 1}</span>
                            <input
                              type="number"
                              value={set.weight || ''}
                              onChange={(e) => updateWeightSet(item.id, sIdx, 'weight', Number(e.target.value))}
                              placeholder="kg"
                              className="w-16 text-center text-sm font-bold bg-white dark:bg-slate-600 rounded-lg px-2 py-1.5 border-none shadow-inner"
                            />
                            <span className="text-xs text-gray-400">kg ×</span>
                            <input
                              type="number"
                              value={set.reps || ''}
                              onChange={(e) => updateWeightSet(item.id, sIdx, 'reps', Number(e.target.value))}
                              placeholder="回"
                              className="w-14 text-center text-sm font-bold bg-white dark:bg-slate-600 rounded-lg px-2 py-1.5 border-none shadow-inner"
                            />
                            <span className="text-xs text-gray-400">回</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => completeWeightExercise(item.id)}
                        className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        <CheckCircle2 size={14} className="inline mr-1" /> 記録する
                      </button>
                    </div>
                  )}

                  {/* 動画プレーヤーエリア */}
                  {activeVideo === item.id && ytId && (
                    <div className="px-5 pb-5 animate-in zoom-in-95 duration-300">
                      <div className="aspect-video rounded-[1.5rem] overflow-hidden bg-black border-2 border-white dark:border-slate-700 shadow-2xl relative">
                        <div id={`yt-player-${item.id}`} className="w-full h-full"></div>
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

      {/* 4. 本日の体調報告 & リハビリ完了 */}
      {isCurrentViewActive && (
        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-blue-500/20 dark:border-blue-500/30 text-center shadow-xl">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isRehab ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-orange-50 dark:bg-orange-500/10'}`}>
            <Activity className={isRehab ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} size={32} />
          </div>
          <h3 className="text-lg font-black mb-1 uppercase tracking-tight">Daily Report</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-8">
            {isRehab ? 'リハビリ後の痛みを選択して完了' : '運動強度（RPE）を選択して完了'}
          </p>
          <div className="grid grid-cols-6 gap-2 mb-10">
            {(isRehab ? [...Array(11).keys()] : [1,2,3,4,5,6,7,8,9,10]).map(val => (
              <button key={val} onClick={() => isRehab ? setSelectedNrs(val) : setSelectedRpe(val)}
                className={`h-12 rounded-xl font-black text-sm transition-all active:scale-90 ${
                  metricValue === val
                    ? `${isRehab ? 'bg-blue-600' : 'bg-orange-600'} text-white ring-4 ${isRehab ? 'ring-blue-100 dark:ring-blue-500/20' : 'ring-orange-100 dark:ring-orange-500/20'} scale-110 z-10`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                }`}>{val}</button>
            ))}
            <div className="flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
              {isRehab ? 'NRS' : 'RPE'}
            </div>
          </div>
          <button onClick={finalizeRehab} disabled={metricValue === null}
            className={`w-full py-5 rounded-[1.5rem] font-black text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
              metricValue !== null
                ? `bg-gradient-to-r ${isRehab ? 'from-blue-600 to-blue-500 shadow-blue-500/40' : 'from-orange-600 to-orange-500 shadow-orange-500/40'} text-white`
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 grayscale opacity-50'
            }`}>
            <Flame size={20} />
            {isRehab ? '本日のリハビリを完了する' : '本日のトレーニングを完了する'}
          </button>
        </section>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 rounded-3xl p-6 flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0"><Info size={24} /></div>
        <div>
          <h5 className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase mb-1">Medical Advice</h5>
          <p className="text-xs text-slate-600 dark:text-blue-200/80 font-bold leading-relaxed italic">「痛みは身体が発するシグナル。無理をしてフェーズを急ぐより、着実にこなすことが完全復帰への近道だぞ。」</p>
        </div>
      </div>
    </div>
  );
}