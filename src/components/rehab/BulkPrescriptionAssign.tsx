import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getPurposeLabel, PURPOSE_OPTIONS, type PrescriptionPurpose } from '../../lib/rehabConstants';
import {
  ArrowLeft, Users, FileText, Check, AlertCircle, Loader2, ChevronDown
} from 'lucide-react';

interface BulkPrescriptionAssignProps {
  onBack: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

interface TeamAthlete {
  id: string;
  name: string;
  team_id: string;
  team_name?: string;
}

interface Template {
  id: string;
  title: string;
  purpose: PrescriptionPurpose;
  body_part_key: string | null;
  phase_details: Record<number, { description: string; boss: string }>;
  estimated_duration: string | null;
  description: string | null;
}

interface TemplateItem {
  name: string;
  quantity: string;
  sets: string;
  phase: number;
  xp: number;
  icon_type: string;
  input_type: string;
  video_url: string | null;
  intensity: string | null;
  rep_range: string | null;
  target_rpe: string | null;
  tempo: string | null;
  rest_seconds: number | null;
  sub_exercise: string | null;
}

export default function BulkPrescriptionAssign({ onBack, showToast }: BulkPrescriptionAssignProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: テンプレート選択
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [purposeFilter, setPurposeFilter] = useState<PrescriptionPurpose | 'all'>('all');

  // Step 2: 選手選択
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set());

  // Step 3: 結果
  const [results, setResults] = useState<{ athleteId: string; name: string; success: boolean; error?: string }[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchAthletes();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .schema('rehab')
      .from('prescriptions')
      .select('id, title, purpose, body_part_key, phase_details, estimated_duration, description')
      .eq('type', 'template')
      .eq('is_archived', false)
      .order('title');
    if (data) setTemplates(data as Template[]);
  };

  const fetchAthletes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // コーチの所属チームを取得
      const { data: coachData } = await supabase
        .from('users')
        .select('team_id, organizations(teams(id, name))')
        .eq('id', user.id)
        .single();

      if (!coachData) return;

      // 組織内の全チームIDを収集
      const orgTeams = (coachData as any).organizations?.teams || [];
      const teamIds = orgTeams.map((t: any) => t.id);
      if (coachData.team_id && !teamIds.includes(coachData.team_id)) {
        teamIds.push(coachData.team_id);
      }

      if (teamIds.length === 0) return;

      // チームの選手を取得
      const { data: athleteData } = await supabase
        .from('users')
        .select('id, name, team_id')
        .eq('role', 'athlete')
        .in('team_id', teamIds)
        .order('name');

      if (athleteData) {
        const teamNameMap: Record<string, string> = {};
        orgTeams.forEach((t: any) => { teamNameMap[t.id] = t.name; });

        setAthletes(athleteData.map(a => ({
          ...a,
          team_name: teamNameMap[a.team_id] || ''
        })));
      }
    } catch (e) {
      console.error('fetchAthletes error', e);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    const { data: items } = await supabase
      .schema('rehab')
      .from('prescription_items')
      .select('name, quantity, sets, phase, xp, icon_type, input_type, video_url, intensity, rep_range, target_rpe, tempo, rest_seconds, sub_exercise')
      .eq('prescription_id', template.id)
      .order('item_index');
    if (items) setTemplateItems(items as TemplateItem[]);
    setStep(2);
  };

  const toggleAthlete = (id: string) => {
    const next = new Set(selectedAthleteIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAthleteIds(next);
  };

  const toggleAll = () => {
    if (selectedAthleteIds.size === athletes.length) {
      setSelectedAthleteIds(new Set());
    } else {
      setSelectedAthleteIds(new Set(athletes.map(a => a.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedTemplate || selectedAthleteIds.size === 0) return;
    setSubmitting(true);
    const assignResults: typeof results = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインしてください');

      const selectedAthletes = athletes.filter(a => selectedAthleteIds.has(a.id));

      // 各選手に個別に処方を作成（Method A）
      const promises = selectedAthletes.map(async (athlete) => {
        try {
          // 同じpurposeの既存active処方を完了にする
          await supabase.schema('rehab').from('prescriptions')
            .update({ status: 'completed' })
            .eq('athlete_user_id', athlete.id)
            .eq('status', 'active')
            .eq('purpose', selectedTemplate.purpose)
            .is('injury_id', null)
            .neq('type', 'template');

          // 処方を作成
          const { data: newPrescription, error: pError } = await supabase
            .schema('rehab')
            .from('prescriptions')
            .insert({
              athlete_user_id: athlete.id,
              trainer_id: user.id,
              type: selectedTemplate.purpose === 'rehab' ? 'rehab' : 'performance',
              purpose: selectedTemplate.purpose,
              title: selectedTemplate.title,
              description: selectedTemplate.description,
              phase_details: selectedTemplate.phase_details,
              start_date: new Date().toISOString().split('T')[0],
              progress_mode: 'manual',
              status: 'active',
              injury_id: null,
            })
            .select()
            .single();

          if (pError) throw pError;

          // エクササイズをコピー
          if (templateItems.length > 0) {
            await supabase.schema('rehab').from('prescription_items').insert(
              templateItems.map((item, index) => ({
                prescription_id: newPrescription.id,
                name: item.name,
                quantity: item.quantity,
                sets: item.sets,
                phase: item.phase,
                item_index: index,
                xp: item.xp,
                icon_type: item.icon_type,
                input_type: item.input_type || 'check',
                video_url: item.video_url,
                intensity: item.intensity,
                rep_range: item.rep_range,
                target_rpe: item.target_rpe,
                tempo: item.tempo,
                rest_seconds: item.rest_seconds,
                sub_exercise: item.sub_exercise,
              }))
            );
          }

          assignResults.push({ athleteId: athlete.id, name: athlete.name, success: true });
        } catch (err: any) {
          assignResults.push({ athleteId: athlete.id, name: athlete.name, success: false, error: err.message });
        }
      });

      await Promise.allSettled(promises);
      setResults(assignResults);
      setStep(3);

      const successCount = assignResults.filter(r => r.success).length;
      const failCount = assignResults.filter(r => !r.success).length;
      if (failCount === 0) {
        showToast(`${successCount}名に処方を割当しました`, 'success');
      } else {
        showToast(`${successCount}名成功、${failCount}名失敗`, 'error');
      }
    } catch (err: any) {
      showToast('一括割当エラー: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTemplates = purposeFilter === 'all'
    ? templates
    : templates.filter(t => t.purpose === purposeFilter);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div>
            <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">一括処方</div>
            <div className="font-bold text-gray-900 dark:text-gray-100">
              {step === 1 && 'テンプレートを選択'}
              {step === 2 && '選手を選択'}
              {step === 3 && '完了'}
            </div>
          </div>
        </div>

        {/* ステップインジケータ */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            }`}>{s}</div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Step 1: テンプレート選択 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPurposeFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${purposeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>
                すべて
              </button>
              {PURPOSE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setPurposeFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${purposeFilter === opt.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">テンプレートがありません</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTemplates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)}
                    className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100">{t.title}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            t.purpose === 'rehab' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                            t.purpose === 'performance' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                            'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>{getPurposeLabel(t.purpose)}</span>
                          {t.estimated_duration && <span className="ml-2">{t.estimated_duration}</span>}
                        </div>
                      </div>
                      <ChevronDown size={16} className="text-gray-300 -rotate-90" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 選手選択 */}
        {step === 2 && selectedTemplate && (
          <div className="space-y-4">
            {/* 選択中テンプレート */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
              <div className="text-xs font-bold text-indigo-500 uppercase mb-1">選択中のテンプレート</div>
              <div className="font-bold text-gray-900 dark:text-gray-100">{selectedTemplate.title}</div>
              <div className="text-xs text-gray-500 mt-1">{templateItems.length}種目 · {getPurposeLabel(selectedTemplate.purpose)}</div>
            </div>

            {/* 全選択 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                <Users size={16} className="inline mr-1" />
                {selectedAthleteIds.size} / {athletes.length} 名選択
              </span>
              <button onClick={toggleAll} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                {selectedAthleteIds.size === athletes.length ? '全解除' : '全選択'}
              </button>
            </div>

            {/* 選手リスト */}
            <div className="space-y-2">
              {athletes.map(athlete => (
                <button key={athlete.id} onClick={() => toggleAthlete(athlete.id)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedAthleteIds.has(athlete.id)
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedAthleteIds.has(athlete.id)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedAthleteIds.has(athlete.id) && <Check size={14} className="text-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{athlete.name}</div>
                    {athlete.team_name && <div className="text-xs text-gray-400">{athlete.team_name}</div>}
                  </div>
                </button>
              ))}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3 pt-4 sticky bottom-4">
              <button onClick={() => { setStep(1); setSelectedTemplate(null); }}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm">
                戻る
              </button>
              <button onClick={handleBulkAssign}
                disabled={selectedAthleteIds.size === 0 || submitting}
                className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> 割当中...</> : <><Users size={16} /> {selectedAthleteIds.size}名に割当</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 結果 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-bold text-lg text-gray-900 dark:text-gray-100">一括割当完了</div>
              <div className="text-sm text-gray-500 mt-1">
                {results.filter(r => r.success).length}名に「{selectedTemplate?.title}」を割当しました
              </div>
            </div>

            <div className="space-y-2">
              {results.map(r => (
                <div key={r.athleteId} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  r.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  {r.success
                    ? <Check size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                    : <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                  }
                  <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{r.name}</div>
                    {r.error && <div className="text-xs text-red-500">{r.error}</div>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={onBack}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm mt-4">
              完了
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
