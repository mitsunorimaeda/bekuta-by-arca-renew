// src/components/TeamSeasonPhaseEditor.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, RotateCcw, Info } from 'lucide-react';

type PhaseType = 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';

type Row = {
  id: string;
  team_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  phase_type: PhaseType;
  focus_tags: string[] | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  teamId: string;
  createdBy?: string; // user.id を渡せるなら渡す（任意）
};

const PHASE_LABEL: Record<PhaseType, string> = {
  off: 'オフ',
  pre: '準備期',
  in: 'シーズン中',
  peak: 'ピーク',
  transition: '移行期',
  unknown: '未設定',
};

const PHASE_OPTIONS: PhaseType[] = ['off', 'pre', 'in', 'peak', 'transition', 'unknown'];

const toTags = (input: string) => {
  // カンマ / 全角カンマ / 改行を許容
  const parts = input
    .split(/,|，|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 重複排除（順序維持）
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      uniq.push(p);
    }
  }
  return uniq;
};

const tagsToInput = (tags: string[] | null | undefined) => (tags && tags.length ? tags.join(', ') : '');

const fmt = (iso: string) => {
  // YYYY-MM-DD -> YYYY/MM/DD
  if (!iso) return '';
  return iso.replaceAll('-', '/');
};

export function TeamSeasonPhaseEditor({ teamId, createdBy }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [phaseType, setPhaseType] = useState<PhaseType>('unknown');
  const [focusTagsInput, setFocusTagsInput] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const isEditing = !!editingId;

  const sortedRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];
    arr.sort((a, b) => {
      const c = a.start_date.localeCompare(b.start_date);
      if (c !== 0) return c;
      return a.end_date.localeCompare(b.end_date);
    });
    return arr;
  }, [rows]);

  const resetForm = () => {
    setEditingId(null);
    setStartDate('');
    setEndDate('');
    setPhaseType('unknown');
    setFocusTagsInput('');
    setNote('');
  };

  const friendlyError = (e: any) => {
    const msg = String(e?.message ?? e ?? '');
    // 期間重複（EXCLUDE）
    if (msg.includes('team_season_phases_no_overlap')) {
      return '期間が重複しています。別の期間にしてください。';
    }
    // start <= end
    if (msg.includes('team_season_phases_date_check')) {
      return '開始日が終了日より後になっています。';
    }
    // check constraint
    if (msg.includes('team_season_phases_phase_type_check')) {
      return 'フェーズ種別が不正です。';
    }
    // Postgres ぽい overlap エラー文の場合も拾う
    if (msg.toLowerCase().includes('exclude') && msg.toLowerCase().includes('overlap')) {
      return '期間が重複しています。別の期間にしてください。';
    }
    return msg || 'エラーが発生しました。';
  };

  const fetchList = async () => {
    if (!teamId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('list_team_season_phases', { p_team_id: teamId });
      if (error) throw error;

      const list = (data ?? []) as any[];
      const mapped: Row[] = list.map((r) => ({
        id: String(r.id),
        team_id: String(r.team_id),
        start_date: String(r.start_date),
        end_date: String(r.end_date),
        phase_type: (r.phase_type ?? 'unknown') as PhaseType,
        focus_tags: Array.isArray(r.focus_tags) ? (r.focus_tags as string[]) : [],
        note: r.note ?? null,
        created_by: r.created_by ?? null,
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
      }));

      setRows(mapped);
    } catch (e: any) {
      console.error('[TeamSeasonPhaseEditor] fetch error', e);
      setRows([]);
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const beginEdit = (row: Row) => {
    setEditingId(row.id);
    setStartDate(row.start_date);
    setEndDate(row.end_date);
    setPhaseType(row.phase_type ?? 'unknown');
    setFocusTagsInput(tagsToInput(row.focus_tags ?? []).join(', '));
    setNote(row.note ?? '');
    setError(null);
  };

  const validate = () => {
    if (!startDate || !endDate) return '開始日・終了日を入力してください。';
    if (startDate > endDate) return '開始日は終了日以前にしてください。';
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const focus_tags = toTags(focusTagsInput);

    try {
      setSaving(true);
      setError(null);

      if (!isEditing) {
        const payload: any = {
          team_id: teamId,
          start_date: startDate,
          end_date: endDate,
          phase_type: phaseType,
          focus_tags,
          note: note?.trim() ? note.trim() : null,
        };
        if (createdBy) payload.created_by = createdBy;

        const { error } = await supabase.from('team_season_phases').insert(payload);
        if (error) throw error;

        resetForm();
        await fetchList();
        return;
      }

      // update
      const payload: any = {
        start_date: startDate,
        end_date: endDate,
        phase_type: phaseType,
        focus_tags,
        note: note?.trim() ? note.trim() : null,
      };

      const { error } = await supabase
        .from('team_season_phases')
        .update(payload)
        .eq('id', editingId)
        .eq('team_id', teamId);

      if (error) throw error;

      resetForm();
      await fetchList();
    } catch (e: any) {
      console.error('[TeamSeasonPhaseEditor] save error', e);
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この期間を削除しますか？')) return;

    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase.from('team_season_phases').delete().eq('id', id).eq('team_id', teamId);
      if (error) throw error;

      // 編集中の行を消した場合はフォームもリセット
      if (editingId === id) resetForm();

      await fetchList();
    } catch (e: any) {
      console.error('[TeamSeasonPhaseEditor] delete error', e);
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">シーズン期分け</div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
            <Info className="w-4 h-4" />
            <span>
              期間は重複できません。フェーズは「オフ/準備期/シーズン中/ピーク/移行期/未設定」。
            </span>
          </div>
        </div>

        <button
          onClick={fetchList}
          className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2"
          disabled={loading || saving}
          title="再読み込み"
        >
          <RotateCcw className="w-4 h-4" />
          更新
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-xs text-gray-600 flex justify-between">
          <span>期間 / フェーズ</span>
          <span>操作</span>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">まだ期分けがありません</div>
        ) : (
          <div className="divide-y">
            {sortedRows.map((r) => {
              const tags = r.focus_tags ?? [];
              const isRowEditing = editingId === r.id;

              return (
                <div key={r.id} className={`px-4 py-3 flex items-start justify-between gap-3 ${isRowEditing ? 'bg-amber-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">
                      {fmt(r.start_date)} 〜 {fmt(r.end_date)}{' '}
                      <span className="text-sm text-gray-600">（{PHASE_LABEL[r.phase_type ?? 'unknown']}）</span>
                    </div>

                    {tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] px-2 py-0.5 rounded-full border bg-white text-gray-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {r.note && <div className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{r.note}</div>}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => beginEdit(r)}
                      className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2"
                      disabled={saving}
                      title="編集"
                    >
                      <Pencil className="w-4 h-4" />
                      編集
                    </button>

                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-red-50 text-red-700 flex items-center gap-2"
                      disabled={saving}
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold text-gray-900">
            {isEditing ? '期分けを編集' : '期分けを追加'}
          </div>

          {isEditing && (
            <button
              onClick={resetForm}
              className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
              disabled={saving}
            >
              キャンセル
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">開始日</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              disabled={saving}
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">終了日</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              disabled={saving}
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">フェーズ</div>
            <select
              value={phaseType}
              onChange={(e) => setPhaseType(e.target.value as PhaseType)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              disabled={saving}
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">フォーカスタグ（カンマ区切り）</div>
            <input
              value={focusTagsInput}
              onChange={(e) => setFocusTagsInput(e.target.value)}
              placeholder="例：speed, strength, recovery"
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              disabled={saving}
            />
            <div className="mt-1 text-[11px] text-gray-500">
              入力例：<span className="font-mono">speed, strength, recovery</span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs text-gray-600 mb-1">メモ</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300"
              disabled={saving}
              placeholder="例：大会が続くので回復優先 / スピード局面を厚めに…"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {!isEditing && (
            <button
              onClick={resetForm}
              className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
              disabled={saving}
            >
              リセット
            </button>
          )}

          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-60"
            disabled={saving}
          >
            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {saving ? '保存中…' : isEditing ? '更新する' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamSeasonPhaseEditor;