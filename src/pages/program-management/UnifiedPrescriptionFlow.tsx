import { useState } from 'react';
import {
  Stethoscope, Zap, Activity, ArrowLeft, ArrowRight,
  ChevronRight, AlertTriangle, Target
} from 'lucide-react';

type Purpose = 'rehab' | 'performance' | 'conditioning';
type FlowStep = 'purpose' | 'injury' | 'goal' | 'assign';

interface UnifiedPrescriptionFlowProps {
  athleteId: string;
  athleteName: string;
  initialPurpose?: Purpose;
  initialInjuryId?: string;
  onStartAssign: (params: {
    athleteId: string;
    purpose: Purpose;
    injuryId?: string;
    goal?: string;
  }) => void;
  onBack: () => void;
}

const PURPOSE_OPTIONS = [
  {
    key: 'rehab' as Purpose,
    label: 'リハビリ',
    description: '怪我の治療・復帰を目指すプログラム',
    icon: Stethoscope,
    color: 'red',
    bgClass: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20',
    selectedClass: 'bg-red-100 dark:bg-red-900/30 border-red-500 ring-2 ring-red-500',
    textClass: 'text-red-600 dark:text-red-400',
    steps: ['怪我を選択', 'テンプレート選択', '処方設定'],
  },
  {
    key: 'performance' as Purpose,
    label: 'パフォーマンス',
    description: '能力向上・身体強化を目指すプログラム',
    icon: Zap,
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20',
    selectedClass: 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 ring-2 ring-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    steps: ['目標設定', 'テンプレート選択', '処方設定'],
  },
  {
    key: 'conditioning' as Purpose,
    label: 'コンディショニング',
    description: '予防・メンテナンスのためのルーティン',
    icon: Activity,
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20',
    selectedClass: 'bg-green-100 dark:bg-green-900/30 border-green-500 ring-2 ring-green-500',
    textClass: 'text-green-600 dark:text-green-400',
    steps: ['テンプレート選択', '処方設定'],
  },
];

export function UnifiedPrescriptionFlow({
  athleteId,
  athleteName,
  initialPurpose,
  initialInjuryId,
  onStartAssign,
  onBack,
}: UnifiedPrescriptionFlowProps) {
  const [purpose, setPurpose] = useState<Purpose | null>(initialPurpose || null);
  const [step, setStep] = useState<FlowStep>(initialPurpose ? (initialPurpose === 'rehab' ? 'injury' : initialPurpose === 'performance' ? 'goal' : 'assign') : 'purpose');
  const [selectedInjuryId, setSelectedInjuryId] = useState(initialInjuryId || '');
  const [goal, setGoal] = useState('');

  const selectedPurpose = PURPOSE_OPTIONS.find(p => p.key === purpose);

  const handlePurposeSelect = (p: Purpose) => {
    setPurpose(p);
    if (p === 'rehab') setStep('injury');
    else if (p === 'performance') setStep('goal');
    else {
      // Conditioning: skip to assign directly
      onStartAssign({ athleteId, purpose: p });
    }
  };

  const handleNext = () => {
    if (step === 'injury') {
      // Move to assign
      onStartAssign({ athleteId, purpose: 'rehab', injuryId: selectedInjuryId || undefined });
    } else if (step === 'goal') {
      onStartAssign({ athleteId, purpose: 'performance', goal: goal.trim() || undefined });
    }
  };

  const handleBack = () => {
    if (step === 'purpose') {
      onBack();
    } else {
      setStep('purpose');
      if (!initialPurpose) setPurpose(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">プログラム作成</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{athleteName}</p>
        </div>
      </div>

      {/* ========== Step: 目的選択 ========== */}
      {step === 'purpose' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">目的を選択してください</p>

          {PURPOSE_OPTIONS.map(option => {
            const Icon = option.icon;
            const isSelected = purpose === option.key;
            return (
              <button
                key={option.key}
                onClick={() => handlePurposeSelect(option.key)}
                className={`w-full border rounded-xl p-5 text-left transition-all ${
                  isSelected ? option.selectedClass : option.bgClass
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-white/50 dark:bg-black/10' : 'bg-white dark:bg-gray-800'}`}>
                    <Icon size={24} className={option.textClass} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-base ${option.textClass}`}>{option.label}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
                    <div className="flex items-center gap-1 mt-3">
                      {option.steps.map((s, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 bg-white/70 dark:bg-gray-800/70 px-2 py-0.5 rounded-full">{s}</span>
                          {i < option.steps.length - 1 && <ChevronRight size={10} className="text-gray-300" />}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ========== Step: 怪我選択（リハビリ） ========== */}
      {step === 'injury' && purpose === 'rehab' && (
        <InjurySelectStep
          athleteId={athleteId}
          selectedInjuryId={selectedInjuryId}
          onSelect={setSelectedInjuryId}
          onNext={handleNext}
          onSkip={() => onStartAssign({ athleteId, purpose: 'rehab' })}
        />
      )}

      {/* ========== Step: 目標設定（パフォーマンス） ========== */}
      {step === 'goal' && purpose === 'performance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">目標を設定</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              何を目指しますか？（任意）
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例: 垂直跳び+5cm、体幹安定性の向上"
              className="w-full px-4 py-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />

            <div className="mt-3 space-y-1">
              <p className="text-[10px] text-gray-400">よくある目標:</p>
              <div className="flex flex-wrap gap-1.5">
                {['体幹強化', '下肢パワー向上', 'ジャンプ力向上', '柔軟性改善', '持久力向上', 'スピード向上'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setGoal(suggestion)}
                    className="text-[10px] px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            テンプレート選択へ <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ====== Injury Select Sub-component ======
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getBodyPartLabel } from '../../lib/rehabConstants';

function InjurySelectStep({
  athleteId,
  selectedInjuryId,
  onSelect,
  onNext,
  onSkip,
}: {
  athleteId: string;
  selectedInjuryId: string;
  onSelect: (id: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [injuries, setInjuries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .schema('rehab')
        .from('injuries')
        .select('id, diagnosis, body_part_key, side, injury_date, status')
        .eq('athlete_user_id', athleteId)
        .in('status', ['active', 'conditioning'])
        .order('created_at', { ascending: false });
      setInjuries(data || []);
      setLoading(false);
    })();
  }, [athleteId]);

  const getSideLabel = (s: string | null) => s === 'left' ? '左' : s === 'right' ? '右' : s === 'both' ? '両側' : '';

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-600" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">対象の怪我を選択</p>
      </div>

      {injuries.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">アクティブな怪我が登録されていません</p>
          <p className="text-xs text-gray-400">カルテから怪我を登録してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {injuries.map(inj => (
            <button
              key={inj.id}
              onClick={() => onSelect(inj.id)}
              className={`w-full border rounded-xl p-4 text-left transition-all ${
                selectedInjuryId === inj.id
                  ? 'bg-red-100 dark:bg-red-900/30 border-red-500 ring-2 ring-red-500'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-red-300'
              }`}
            >
              <div className="font-bold text-sm text-gray-900 dark:text-white">
                {getSideLabel(inj.side)}{inj.diagnosis}
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {getBodyPartLabel(inj.body_part_key)}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  inj.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {inj.status === 'active' ? '治療中' : 'コンディショニング'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSkip}
          className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-500 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          怪我に紐づけない
        </button>
        <button
          onClick={onNext}
          disabled={!selectedInjuryId}
          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          次へ <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default UnifiedPrescriptionFlow;
