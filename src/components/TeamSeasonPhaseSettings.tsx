// src/components/TeamSeasonPhaseSettings.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, X, AlertTriangle, Save } from 'lucide-react';

type PhaseType = 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';

type TeamSeasonPhase = {
  id: string;
  team_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  phase_type: PhaseType;
  focus_tags: string[];
  note: string | null;
};

type Props = {
  teamId: string;
  /** team名は表示用。なくても動く */
  teamName?: string;
};

const PHASE_LABEL: Record<PhaseType, string> = {
  off: 'オフ',
  pre: 'プレ（準備）',
  in: 'イン（通常）',
  peak: 'ピーク',
  transition: '移行',
  unknown: '未設定',
};

const PHASE_BADGE: Record<PhaseType, string> = {
  off: 'bg-gray-100 text-gray-700 border-gray-200',
  pre: 'bg-blue-50 text-blue-700 border-blue-200',
  in: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  peak: 'bg-rose-50 text-rose-700 border-rose-200',
  transition: 'bg-amber-50 text-amber-700 border-amber-200',
  unknown: 'bg-slate-50 text-slate-700 border-slate-200',
};

const toShortRange = (s: string, e: string) => {
  const sm = Number(s.slice(5, 7));
  const sd = Number(s.slice(8, 10));
  const em = Number(e.slice(5, 7));
  const ed = Number(e.slice(8, 10));
  if (!sm || !sd || !em || !ed) return `${s}〜${e}`;
  return `${sm}/${sd}–${em}/${ed}`;
};

const todayISO = () => {
  const d = new Date();
  // JSTで "YYYY-MM-DD"
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
};

const inRange = (date: string, start: string, end: string) => start <= date && date <= end;

const normalizeTags = (input: string) => {
  // "基礎, フォーム 筋力" みたいなのも吸う
  return input
    .split(/[,、\n\t ]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
};

function validatePhase(p: Partial<TeamSeasonPhase>) {
  const errs: string[] = [];
  if (!p.start_date) errs.push('開始日が未入力です');
  if (!p.end_date) errs.push('終了日が未入力です');
  if (p.start_date && p.end_date && p.start_date > p.end_date) errs.push('開始日 > 終了日 になっています');
  if (!p.phase_type) errs.push('フェーズが未選択です');
  return errs;
}

export function TeamSeasonPhaseSettings({ teamId, teamName }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [phases, setPhases] = useState<TeamSeasonPhase[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // form
  const [startDate, setStartDate] = useState<string>(() => todayISO());
  const [endDate, setEndDate] = useState<string>(() => addDays(todayISO(), 20));
  const [phaseType, setPhaseType] = useState<PhaseType>('pre');
  const [tagsText, setTagsText] = useState<string>('基礎 フォーム 筋力');
  const [note, setNote] = useState<string>('');

  const sortedPhases = useMemo(() => {
    return [...phases].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  }, [phases]);

  const today = todayISO();
  const currentPhase = useMemo(() => {
    return sortedPhases.find((p) => inRange(today, p.start_date, p.end_date)) ?? null;
  }, [sortedPhases, today]);

  const next3Weeks = useMemo(() => {
    const end = addDays(today, 21);
    // 期間が1日でも重なるもの
    return sortedPhases.filter((p) => !(p.end_date < today || end < p.start_date));
  }, [sortedPhases, today]);

  const isSamePhase = (a: TeamSeasonPhase | null, b: TeamSeasonPhase | null) => {
    if (!a || !b) return false;
    return a.phase_type === b.phase_type && a.start_date === b.start_date && a.end_date === b.end_date;
  };
  
  const next3WeeksNoDup = useMemo(() => {
    return next3Weeks.filter((p) => !isSamePhase(p, currentPhase));
  }, [next3Weeks, currentPhase]);

  const resetFormForCreate = () => {
    const t = todayISO();
    setStartDate(t);
    setEndDate(addDays(t, 20));
    setPhaseType('pre');
    setTagsText('基礎 フォーム 筋力');
    setNote('');
    setMode('create');
    setEditingId(null);
  };

  const openCreate = () => {
    resetFormForCreate();
    setErr(null);
    setModalOpen(true);
  };

  const openEdit = (p: TeamSeasonPhase) => {
    setMode('edit');
    setEditingId(p.id);
    setStartDate(p.start_date);
    setEndDate(p.end_date);
    setPhaseType(p.phase_type);
    setTagsText((p.focus_tags ?? []).join(' '));
    setNote(p.note ?? '');
    setErr(null);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const fetchPhases = async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setErr(null);

      // ✅ RPC（あなたの環境で既に存在）
      const { data, error } = await supabase.rpc('list_team_season_phases', {
        p_team_id: teamId,
      });

      if (error) throw error;

      const rows = (data ?? []) as any[];
      const mapped: TeamSeasonPhase[] = rows.map((r) => ({
        id: r.id,
        team_id: r.team_id ?? teamId,
        start_date: r.start_date,
        end_date: r.end_date,
        phase_type: (r.phase_type ?? 'unknown') as PhaseType,
        focus_tags: Array.isArray(r.focus_tags) ? r.focus_tags : [],
        note: r.note ?? null,
      }));

      setPhases(mapped);
    } catch (e: any) {
      console.error('[TeamSeasonPhaseSettings] fetch error', e);
      setErr(e?.message ?? '取得に失敗しました');
      setPhases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const onSave = async () => {
    try {
      setSaving(true);
      setErr(null);

      const payload: Partial<TeamSeasonPhase> = {
        start_date: startDate,
        end_date: endDate,
        phase_type: phaseType,
        focus_tags: normalizeTags(tagsText),
        note: note.trim() ? note.trim() : null,
      };

      const errs = validatePhase(payload);
      if (errs.length > 0) {
        setErr(errs.join(' / '));
        return;
      }

      if (mode === 'create') {
        const { error } = await supabase.from('team_season_phases').insert({
          team_id: teamId,
          start_date: payload.start_date,
          end_date: payload.end_date,
          phase_type: payload.phase_type,
          focus_tags: payload.focus_tags ?? [],
          note: payload.note ?? null,
          // created_by は DB で auth.uid() を使う運用でもOK。ここでは未指定。
        });
        if (error) throw error;
      } else {
        if (!editingId) throw new Error('editingId is missing');
        const { error } = await supabase
          .from('team_season_phases')
          .update({
            start_date: payload.start_date,
            end_date: payload.end_date,
            phase_type: payload.phase_type,
            focus_tags: payload.focus_tags ?? [],
            note: payload.note ?? null,
          })
          .eq('id', editingId)
          .eq('team_id', teamId);
        if (error) throw error;
      }

      await fetchPhases();
      closeModal();
    } catch (e: any) {
      console.error('[TeamSeasonPhaseSettings] save error', e);
      setErr(e?.message ?? '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: TeamSeasonPhase) => {
    const ok = window.confirm(`削除しますか？\n${p.start_date}〜${p.end_date} / ${PHASE_LABEL[p.phase_type]}`);
    if (!ok) return;

    try {
      setSaving(true);
      setErr(null);

      const { error } = await supabase
        .from('team_season_phases')
        .delete()
        .eq('id', p.id)
        .eq('team_id', teamId);

      if (error) throw error;

      await fetchPhases();
    } catch (e: any) {
      console.error('[TeamSeasonPhaseSettings] delete error', e);
      setErr(e?.message ?? '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ✅ Header（コンパクト） */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">設定（フェーズ）</div>
            <div className="text-base font-bold text-gray-900 truncate">
              チームフェーズ{teamName ? ` - ${teamName}` : ''}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              ※ 選手側トップに「今日」と「今後3週間」を表示
            </div>
          </div>
  
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>
  
        {err && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="min-w-0">{err}</div>
          </div>
        )}
      </div>
  
      {/* Preview（モバイル最適） */}
        <div className="space-y-4">
          {/* 今日（選手側カード風） */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">チームフェーズ</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  今日
                </span>
              </div>

              <span className="text-xs text-gray-500">
                {currentPhase ? toShortRange(currentPhase.start_date, currentPhase.end_date) : '未設定'}
              </span>
            </div>

            {/* Body */}
            {currentPhase ? (
              <>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900 truncate">
                        {PHASE_LABEL[currentPhase.phase_type]}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PHASE_BADGE[currentPhase.phase_type]}`}>
                        {currentPhase.phase_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tags（最大6 +n） */}
                {Array.isArray(currentPhase.focus_tags) && currentPhase.focus_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentPhase.focus_tags.slice(0, 6).map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {currentPhase.focus_tags.length > 6 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        +{currentPhase.focus_tags.length - 6}
                      </span>
                    )}
                  </div>
                )}

                {/* Note（2行で省略） */}
                {currentPhase.note && (
                  <p className="mt-3 text-sm text-gray-700 line-clamp-2">
                    {currentPhase.note}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-3 text-sm text-gray-600">
                フェーズが未設定です（＋追加 から登録すると表示されます）
              </div>
            )}
          </div>

          {/* 今後3週間（横スクロールのミニカード） */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">今後3週間</div>
                <div className="text-xs text-gray-500">横にスクロール</div>
              </div>
              <div className="text-[11px] text-gray-400">
                {today}〜{addDays(today, 21)}
              </div>
            </div>

            {next3Weeks.length === 0 ? (
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                期間内のフェーズがありません
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {next3Weeks.slice(0, 6).map((p, idx) => {
                  const isSameAsToday =
                    currentPhase &&
                    p.phase_type === currentPhase.phase_type &&
                    p.start_date === currentPhase.start_date &&
                    p.end_date === currentPhase.end_date;

                  return (
                    <div
                      key={`${p.id}-${idx}`}
                      className={`min-w-[170px] rounded-lg border p-3 ${
                        isSameAsToday
                          ? 'border-blue-200 bg-blue-50/60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {PHASE_LABEL[p.phase_type]}
                        </div>
                        <div className="text-[11px] text-gray-500 whitespace-nowrap">
                          {toShortRange(p.start_date, p.end_date)}
                        </div>
                      </div>

                      

                      {Array.isArray(p.focus_tags) && p.focus_tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.focus_tags.slice(0, 3).map((t, i) => (
                            <span
                              key={`${p.id}-${t}-${i}`}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                            >
                              {t}
                            </span>
                          ))}
                          {p.focus_tags.length > 3 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              +{p.focus_tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {p.note && (
                        <div className="mt-2 text-xs text-gray-600 line-clamp-1">
                          {p.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      {/* ✅ 登録済み（リスト：モバイル向けに圧縮） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">登録済みフェーズ</div>
          <button
            onClick={fetchPhases}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? '更新中…' : '更新'}
          </button>
        </div>
  
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : sortedPhases.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-600">
            まだフェーズがありません。「追加」から登録してください。
          </div>
        ) : (
          <div className="divide-y">
            {sortedPhases.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${PHASE_BADGE[p.phase_type]}`}
                      >
                        {PHASE_LABEL[p.phase_type]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {p.start_date}〜{p.end_date}
                      </span>
                    </div>
  
                    {!!(p.focus_tags?.length) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.focus_tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            {t}
                          </span>
                        ))}
                        {p.focus_tags.length > 4 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            +{p.focus_tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
  
                    {p.note && <div className="mt-2 text-xs text-gray-600 line-clamp-2">{p.note}</div>}
                  </div>
  
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 rounded-lg border bg-white hover:bg-gray-50"
                      title="編集"
                    >
                      <Pencil className="w-4 h-4 text-gray-700" />
                    </button>
  
                    <button
                      onClick={() => onDelete(p)}
                      className="p-2 rounded-lg border bg-white hover:bg-red-50"
                      title="削除"
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ✅ Modal（ここはあなたの現行コードをそのまま残す） */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeModal}>
          <div
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
     
            <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-500">チームフェーズ</div>
                <div className="text-lg font-bold text-gray-900 truncate">
                  {mode === 'create' ? '追加' : '編集'}
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={closeModal} aria-label="close">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-gray-600 mb-1">開始日</div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-gray-600 mb-1">終了日</div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs text-gray-600 mb-1">フェーズ</div>
                <select
                  value={phaseType}
                  onChange={(e) => setPhaseType(e.target.value as PhaseType)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                >
                  <option value="off">オフ</option>
                  <option value="pre">プレ（準備）</option>
                  <option value="in">イン（通常）</option>
                  <option value="peak">ピーク</option>
                  <option value="transition">移行</option>
                  <option value="unknown">未設定</option>
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-gray-600 mb-1">フォーカスタグ（スペース/カンマ区切り）</div>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300"
                  placeholder="例：基礎 フォーム 筋力"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizeTags(tagsText).map((t) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {t}
                    </span>
                  ))}
                </div>
              </label>

              <label className="block">
                <div className="text-xs text-gray-600 mb-1">メモ（任意）</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 min-h-[90px]"
                  placeholder="例：まずは土台づくり（仮）"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-semibold"
                  disabled={saving}
                >
                  キャンセル
                </button>

                <button
                  onClick={onSave}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>

              <div className="text-[11px] text-gray-500">
                ※ 期間が重複するとDB側の制約（EXCLUDE）で弾かれます。必要なら期間を調整してね。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamSeasonPhaseSettings;