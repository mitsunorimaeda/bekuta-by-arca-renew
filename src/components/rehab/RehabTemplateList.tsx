import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Sword, Calendar, Edit2,
  LayoutGrid, Trash2, Plus, Archive, RotateCcw, Filter, Stethoscope, Activity
} from 'lucide-react';
import { BODY_PART_OPTIONS, getBodyPartLabel } from '../../lib/rehabConstants';

interface RehabAthlete {
  athlete_user_id: string;
  athlete_name: string;
  diagnosis: string;
  body_part_key: string | null;
  injury_status: string;
  prescription_title: string | null;
  current_phase: number | null;
}

interface RehabTemplateListProps {
  onOpenEditor: (templateId?: string) => void;
  onBack: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onAthleteSelect?: (athleteId: string) => void;
}

export default function RehabTemplateList({ onOpenEditor, onBack, showToast, onAthleteSelect }: RehabTemplateListProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [rehabAthletes, setRehabAthletes] = useState<RehabAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBodyPart, setFilterBodyPart] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchData();
    fetchRehabAthletes();
  }, [filterBodyPart, showArchived]);

  const fetchRehabAthletes = async () => {
    try {
      const { data: injuries } = await supabase
        .schema('rehab')
        .from('injuries')
        .select('athlete_user_id, diagnosis, body_part_key, status')
        .in('status', ['active', 'conditioning']);

      if (!injuries || injuries.length === 0) { setRehabAthletes([]); return; }

      const athleteIds = [...new Set(injuries.map(i => i.athlete_user_id))];

      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', athleteIds);

      const { data: prescriptions } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .select('athlete_user_id, title, current_phase, injury_id')
        .eq('status', 'active')
        .in('athlete_user_id', athleteIds);

      const userMap: Record<string, string> = {};
      users?.forEach(u => { userMap[u.id] = u.name; });

      const presMap: Record<string, { title: string; current_phase: number }> = {};
      prescriptions?.forEach(p => { presMap[p.athlete_user_id] = { title: p.title, current_phase: p.current_phase }; });

      const result: RehabAthlete[] = injuries.map(inj => ({
        athlete_user_id: inj.athlete_user_id,
        athlete_name: userMap[inj.athlete_user_id] || '不明',
        diagnosis: inj.diagnosis,
        body_part_key: inj.body_part_key,
        injury_status: inj.status,
        prescription_title: presMap[inj.athlete_user_id]?.title || null,
        current_phase: presMap[inj.athlete_user_id]?.current_phase || null,
      }));

      setRehabAthletes(result);
    } catch (e) {
      console.error('[RehabTemplateList] fetchRehabAthletes error', e);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .schema('rehab')
        .from('prescriptions')
        .select('*')
        .eq('type', 'template')
        .order('created_at', { ascending: false });

      if (!showArchived) {
        query = query.or('is_archived.is.null,is_archived.eq.false');
      }
      if (filterBodyPart) {
        query = query.eq('body_part_key', filterBodyPart);
      }

      const { data: templateData, error: templateError } = await query;
      if (templateError) throw templateError;
      setTemplates(templateData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleArchive = async (template: any) => {
    const newVal = !template.is_archived;
    try {
      await supabase.schema('rehab').from('prescriptions')
        .update({ is_archived: newVal }).eq('id', template.id);
      fetchData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const deleteTemplate = async (template: any) => {
    if (!window.confirm(`「${template.title}」を完全に削除しますか？\n※ 既に選手に割り当て済みの処方には影響しません。`)) return;
    try {
      const { error } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      showToast("テンプレートを削除しました", 'success');
      fetchData();
    } catch (e: any) {
      showToast("エラーが発生しました: " + e.message, 'error');
    }
  };



  return (
    <div className="min-h-screen bg-white dark:bg-gray-800 p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center tracking-tighter uppercase">
              <LayoutGrid size={32} className="mr-3 text-blue-600" /> プログラムテンプレート
            </h2>
            <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-xs">
              リハビリプログラムのテンプレート管理
            </p>
          </div>
          <button
            onClick={() => onOpenEditor()}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 flex items-center transition-all active:scale-95 text-sm uppercase tracking-widest"
          >
            <Plus size={20} className="mr-2 stroke-[3]" /> 新規プログラム作成
          </button>
        </div>

        {/* リハビリ中の選手 */}
        {rehabAthletes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Stethoscope size={18} className="text-orange-500" /> リハビリ中の選手 ({rehabAthletes.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {rehabAthletes.map((ra, idx) => (
                <div key={idx} onClick={() => onAthleteSelect?.(ra.athlete_user_id)} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-300">
                      {ra.athlete_name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{ra.athlete_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ra.injury_status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                          {ra.injury_status === 'active' ? 'Active' : 'Cond.'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ra.diagnosis}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {ra.prescription_title ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{ra.prescription_title}</span>
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">Phase {ra.current_phase}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">未処方</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* フィルタUI */}
        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filterBodyPart}
            onChange={(e) => setFilterBodyPart(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700 border-none rounded-xl py-2 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none"
          >
            <option value="">全ての部位</option>
            {BODY_PART_OPTIONS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
            アーカイブ済みを表示
          </label>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <Sword size={48} className="text-gray-200 dark:text-gray-600 animate-bounce mb-6" />
            <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs">読み込み中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-24 bg-white dark:bg-gray-800 rounded-2xl border-4 border-dashed border-gray-200 dark:border-gray-700">
                <Sword size={64} className="mx-auto text-gray-200 dark:text-gray-600 mb-6" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-lg">テンプレートがありません</p>
                <button onClick={() => onOpenEditor()} className="text-blue-500 font-bold mt-4 inline-block hover:underline">最初のテンプレートを作成する</button>
              </div>
            ) : (
              templates.map(t => (
                <div key={t.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-500/30 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/5 transition-all group flex flex-col ${t.is_archived ? 'opacity-60' : ''}`}>
                  <div className="p-8 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                          リハビリプログラム
                        </span>
                        {t.body_part_key && (
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                            {getBodyPartLabel(t.body_part_key)}
                          </span>
                        )}
                        {t.is_archived && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold px-3 py-1.5 rounded-full">ARCHIVED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleArchive(t)}
                          className="p-2.5 text-gray-200 dark:text-gray-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all"
                          title={t.is_archived ? "Unarchive" : "Archive"}
                        >
                          {t.is_archived ? <RotateCcw size={18} /> : <Archive size={18} />}
                        </button>
                        <button
                          onClick={() => deleteTemplate(t)}
                          className="p-2.5 text-gray-200 dark:text-gray-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                          title="Delete Template"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 group-hover:text-blue-600 transition-colors tracking-tight leading-tight">
                      {t.title}
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-8 line-clamp-3 leading-relaxed">
                      {t.description || "No description provided."}
                    </p>

                    <div className="flex items-center text-xs font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mt-auto">
                      <div className="flex items-center bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-600 text-gray-400">
                        <Calendar size={14} className="mr-2 text-blue-400" />
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => onOpenEditor(t.id)}
                      className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold py-4 rounded-2xl flex items-center justify-center transition-all border border-gray-200 dark:border-gray-600 uppercase tracking-widest shadow-sm active:scale-95"
                    >
                      <Edit2 size={16} className="mr-2 text-blue-500" /> 編集
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
