import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getPurposeLabel, getPurposeColor, getItemStatus } from '../lib/rehabConstants';
import {
  Stethoscope, Zap, Activity, ChevronLeft, ChevronRight,
  CheckCircle2, Trophy, Flame
} from 'lucide-react';

interface PrescriptionCardListProps {
  userId: string;
  onBackHome: () => void;
  onOpenQuest: (prescriptionId: string, purpose: string) => void;
}

interface PrescriptionCard {
  id: string;
  title: string;
  purpose: string;
  current_phase: number;
  phase_details: Record<string, any> | null;
  injury_id: string | null;
  injury_diagnosis?: string;
  items: any[];
  todayLog: any | null;
}

export default function PrescriptionCardList({ userId, onBackHome, onOpenQuest }: PrescriptionCardListProps) {
  const [cards, setCards] = useState<PrescriptionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [allComplete, setAllComplete] = useState(false);

  useEffect(() => {
    fetchPrescriptions();
  }, [userId]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 全active処方を取得
      const { data: prescriptions } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('id, title, purpose, current_phase, phase_details, injury_id')
        .eq('athlete_user_id', userId)
        .in('status', ['active', 'conditioning'])
        .neq('type', 'template')
        .order('created_at', { ascending: false });

      if (!prescriptions || prescriptions.length === 0) {
        setCards([]);
        return;
      }

      // 各処方のアイテムと今日のログを取得
      const cardPromises = prescriptions.map(async (pres) => {
        const [itemsRes, logRes, injuryRes] = await Promise.all([
          supabase.schema('rehab').from('prescription_items').select('id, phase').eq('prescription_id', pres.id),
          supabase.schema('rehab').from('prescription_daily_logs').select('*').eq('prescription_id', pres.id).eq('log_date', today).maybeSingle(),
          pres.injury_id
            ? supabase.schema('rehab').from('injuries').select('diagnosis').eq('id', pres.injury_id).single()
            : Promise.resolve({ data: null })
        ]);

        return {
          ...pres,
          items: itemsRes.data || [],
          todayLog: logRes.data,
          injury_diagnosis: injuryRes.data?.diagnosis || undefined,
        } as PrescriptionCard;
      });

      const resolvedCards = await Promise.all(cardPromises);
      setCards(resolvedCards);

      // 全カード完了チェック
      const complete = resolvedCards.length > 0 && resolvedCards.every(card => {
        if (!card.todayLog?.item_results) return false;
        const currentPhaseItems = card.items.filter(i => i.phase === card.current_phase);
        return currentPhaseItems.length > 0 && currentPhaseItems.every(item =>
          getItemStatus(card.todayLog.item_results[item.id]) !== 'none'
        );
      });
      setAllComplete(complete);

    } catch (e) {
      console.error('fetchPrescriptions error', e);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForCard = (card: PrescriptionCard) => {
    const currentPhaseItems = card.items.filter(i => i.phase === card.current_phase);
    if (currentPhaseItems.length === 0) return { done: 0, total: 0 };
    const done = currentPhaseItems.filter(item =>
      getItemStatus(card.todayLog?.item_results?.[item.id]) !== 'none'
    ).length;
    return { done, total: currentPhaseItems.length };
  };

  const getPurposeIcon = (purpose: string) => {
    if (purpose === 'rehab') return <Stethoscope size={20} />;
    if (purpose === 'performance') return <Zap size={20} />;
    return <Activity size={20} />;
  };

  const getPurposeBgColor = (purpose: string) => {
    if (purpose === 'rehab') return 'from-red-500 to-rose-600';
    if (purpose === 'performance') return 'from-blue-500 to-indigo-600';
    return 'from-green-500 to-emerald-600';
  };

  const getPurposeLightBg = (purpose: string) => {
    if (purpose === 'rehab') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (purpose === 'performance') return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  };

  if (loading) {
    return <div className="p-10 text-center text-blue-600 font-bold animate-pulse">プログラムを読み込み中...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in pb-20">
        <button onClick={onBackHome} className="flex items-center text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-blue-600 transition-colors">
          <ChevronLeft size={16} className="mr-1" /> ホームへ戻る
        </button>
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Activity size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="font-bold text-gray-400">処方されたプログラムはありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <button onClick={onBackHome} className="flex items-center text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-blue-600 transition-colors">
        <ChevronLeft size={16} className="mr-1" /> ホームへ戻る
      </button>

      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">今日のメニュー</h2>
        <p className="text-xs text-gray-400 mt-1">
          {cards.length}つのプログラム · 計{cards.reduce((sum, c) => sum + c.items.filter(i => i.phase === c.current_phase).length, 0)}項目
        </p>
      </div>

      {/* 全完了アニメーション */}
      {allComplete && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl p-6 text-center text-white shadow-xl animate-in zoom-in duration-500">
          <Trophy size={40} className="mx-auto mb-2" />
          <h3 className="text-xl font-bold">本日のメニュー全完了！</h3>
          <p className="text-sm opacity-80 mt-1">お疲れさまでした</p>
        </div>
      )}

      {/* カード一覧 */}
      <div className="space-y-4">
        {cards.map(card => {
          const progress = getProgressForCard(card);
          const isCardComplete = progress.total > 0 && progress.done === progress.total;

          return (
            <button
              key={card.id}
              onClick={() => onOpenQuest(card.id, card.purpose)}
              className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg active:scale-[0.98] ${
                isCardComplete
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* 上部: グラデーションバー */}
              <div className={`h-1.5 bg-gradient-to-r ${getPurposeBgColor(card.purpose)}`}
                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
              />

              <div className="p-5 flex items-center gap-4">
                {/* アイコン */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  isCardComplete
                    ? 'bg-green-500 text-white'
                    : `bg-gradient-to-br ${getPurposeBgColor(card.purpose)} text-white`
                }`}>
                  {isCardComplete ? <CheckCircle2 size={24} /> : getPurposeIcon(card.purpose)}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{card.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPurposeLightBg(card.purpose)}`}>
                      {getPurposeLabel(card.purpose)}
                    </span>
                    {card.injury_diagnosis && (
                      <span className="text-[10px] text-gray-400 truncate">{card.injury_diagnosis}</span>
                    )}
                    <span className="text-[10px] text-gray-400">Phase {card.current_phase}</span>
                  </div>
                </div>

                {/* 進捗 */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-bold ${isCardComplete ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                    {progress.done}/{progress.total}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 ml-auto" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
