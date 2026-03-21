import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Copy, Sword, Calendar, Edit2,
  LayoutGrid, Trash2, Plus, Archive, RotateCcw, Filter
} from 'lucide-react';
import { BODY_PART_OPTIONS, getBodyPartLabel } from '../../lib/rehabConstants';

interface RehabTemplateListProps {
  onOpenEditor: (templateId?: string) => void;
  onBack: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function RehabTemplateList({ onOpenEditor, onBack, showToast }: RehabTemplateListProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBodyPart, setFilterBodyPart] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterBodyPart, showArchived]);

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

  const quickAssignToMe = async (template: any) => {
    if (!window.confirm(`「${template.title}」を自分自身に割り当ててテストしますか？`)) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: archiveError } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .update({ status: 'completed' })
        .eq('athlete_user_id', user.id)
        .eq('status', 'active')
        .is('injury_id', null);

      if (archiveError) throw archiveError;

      const { data: newPrescription, error: pError } = await supabase
        .schema('rehab')
        .from('prescriptions')
        .insert({
          athlete_user_id: user.id,
          trainer_id: user.id,
          type: 'assigned',
          title: template.title,
          description: template.description,
          status: 'active'
        })
        .select()
        .single();
      if (pError) throw pError;

      const { data: sourceItems } = await supabase
        .schema('rehab')
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', template.id);

      if (sourceItems && sourceItems.length > 0) {
        const itemsToInsert = sourceItems.map(item => ({
          prescription_id: newPrescription.id,
          name: item.name,
          quantity: item.quantity,
          sets: item.sets,
          phase: item.phase,
          xp: item.xp,
          icon_type: item.icon_type,
          video_url: item.video_url,
          item_index: item.item_index
        }));
        await supabase.schema('rehab').from('prescription_items').insert(itemsToInsert);
      }

      showToast("リハビリボードを確認してください", 'success');
      onBack();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

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

                  <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4">
                    <button
                      onClick={() => onOpenEditor(t.id)}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold py-4 rounded-2xl flex items-center justify-center transition-all border border-gray-200 dark:border-gray-600 uppercase tracking-widest shadow-sm active:scale-95"
                    >
                      <Edit2 size={16} className="mr-2 text-blue-500" /> 編集
                    </button>
                    <button
                      onClick={() => quickAssignToMe(t)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-4 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 active:scale-95 uppercase tracking-widest"
                    >
                      <Copy size={16} className="mr-2" /> テスト割当
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
