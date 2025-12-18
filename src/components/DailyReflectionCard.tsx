import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';

type ActionItem = {
  text: string;
  done: boolean;
  done_at: string | null;
};

type ReflectionRow = {
  id: string;
  user_id: string;
  reflection_date: string; // 'YYYY-MM-DD'
  did: string | null;
  didnt: string | null;
  cause_tags: string[] | null;
  next_action: string | null;
  next_action_items: ActionItem[] | null; // jsonb
  free_note: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

function getTodayJSTString() {
  // JSTで YYYY-MM-DD
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function getYesterdayJSTString() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() - 1);
  return jst.toISOString().slice(0, 10);
}

function normalizeActionItems(row?: ReflectionRow | null): ActionItem[] {
  if (!row) return [];
  const items = row.next_action_items ?? [];
  if (Array.isArray(items) && items.length > 0) return items;

  // 互換：旧 next_action があれば1件に変換
  if (row.next_action && row.next_action.trim()) {
    return [{ text: row.next_action.trim(), done: false, done_at: null }];
  }
  return [];
}

export function DailyReflectionCard() {
  const today = useMemo(() => getTodayJSTString(), []);
  const yesterday = useMemo(() => getYesterdayJSTString(), []);

  const [loading, setLoading] = useState(true);

  // 今日の reflection（入力・保存対象）
  const [todayRow, setTodayRow] = useState<ReflectionRow | null>(null);

  // 昨日の reflection（＝今日やることの“出どころ”）
  const [yesterdayRow, setYesterdayRow] = useState<ReflectionRow | null>(null);

  // 今日やること（昨日の目標）
  const [todayTodo, setTodayTodo] = useState<ActionItem[]>([]);

  // 今日の振り返りで「明日の行動目標（複数）」を編集する用
  const [tomorrowActions, setTomorrowActions] = useState<ActionItem[]>([
    { text: '', done: false, done_at: null },
  ]);

  const [did, setDid] = useState('');
  const [didnt, setDidnt] = useState('');
  const [causeTags, setCauseTags] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');

  const [savingTodo, setSavingTodo] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  // 初期ロード：今日・昨日をまとめて取得
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('reflections')
          .select('*')
          .eq('user_id', userId)
          .in('reflection_date', [today, yesterday]);

        if (error) throw error;

        const t = (data || []).find((r: any) => r.reflection_date === today) ?? null;
        const y = (data || []).find((r: any) => r.reflection_date === yesterday) ?? null;

        setTodayRow(t as ReflectionRow | null);
        setYesterdayRow(y as ReflectionRow | null);

        // 今日やること（昨日の next_action_items）
        const todo = normalizeActionItems(y as ReflectionRow | null);
        setTodayTodo(todo);

        // 今日の入力フォーム（既存があれば反映）
        if (t) {
          setDid((t as any).did ?? '');
          setDidnt((t as any).didnt ?? '');
          setCauseTags((t as any).cause_tags ?? []);
          setFreeNote((t as any).free_note ?? '');

          // 今日の reflection に保存されている「明日の行動目標」を編集状態へ
          const items = normalizeActionItems(t as ReflectionRow);
          setTomorrowActions(items.length ? items : [{ text: '', done: false, done_at: null }]);
        } else {
          // 新規作成時
          setTomorrowActions([{ text: '', done: false, done_at: null }]);
        }
      } catch (e) {
        console.error('Failed to load reflections:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [today, yesterday]);

  // --- ここから追加：今日やること（昨日の目標）を完了保存 ---
  const toggleTodoDone = async (index: number) => {
    // 昨日の行動目標がないなら何もしない
    if (!yesterdayRow) return;

    const next = [...todayTodo];
    const target = next[index];
    if (!target) return;

    const nowIso = new Date().toISOString();
    const toggled: ActionItem = {
      ...target,
      done: !target.done,
      done_at: !target.done ? nowIso : null,
    };
    next[index] = toggled;

    // 楽観的更新
    setTodayTodo(next);

    // 即保存（完了保存）
    setSavingTodo(true);
    try {
      const { error } = await supabase
        .from('reflections')
        .update({
          next_action_items: next,
          // 互換のため：先頭要素を next_action に入れておく（任意）
          next_action: next[0]?.text ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', yesterdayRow.id);

      if (error) throw error;

      // local rowも更新
      setYesterdayRow((prev) => (prev ? { ...prev, next_action_items: next, next_action: next[0]?.text ?? null } : prev));
    } catch (e) {
      console.error('Failed to save todo:', e);
      // 失敗時は戻す（最低限）
      setTodayTodo(normalizeActionItems(yesterdayRow));
    } finally {
      setSavingTodo(false);
    }
  };
  // --- 追加ここまで ---

  const addTomorrowAction = () => {
    setTomorrowActions((prev) => [...prev, { text: '', done: false, done_at: null }]);
  };

  const removeTomorrowAction = (i: number) => {
    setTomorrowActions((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [{ text: '', done: false, done_at: null }];
    });
  };

  const updateTomorrowActionText = (i: number, text: string) => {
    setTomorrowActions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], text };
      return next;
    });
  };

  // 今日の振り返り保存（明日の行動目標＝複数化して保存）
  const saveTodayReflection = async () => {
    setSavingReflection(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      // 空の行動目標は除外
      const cleanedActions = tomorrowActions
        .map((a) => ({ ...a, text: (a.text ?? '').trim() }))
        .filter((a) => a.text.length > 0);

      const payload = {
        user_id: userId,
        reflection_date: today,
        did: did.trim(),
        didnt: didnt.trim(),
        cause_tags: causeTags,
        free_note: freeNote.trim(),
        next_action_items: cleanedActions,                 // ✅複数
        next_action: cleanedActions[0]?.text ?? null,      // ✅互換
        metadata: { source: 'daily_reflection_card' },
        updated_at: new Date().toISOString(),
      };

      if (todayRow?.id) {
        const { error } = await supabase
          .from('reflections')
          .update(payload)
          .eq('id', todayRow.id);

        if (error) throw error;

        setTodayRow((prev) => (prev ? ({ ...prev, ...payload } as any) : prev));
      } else {
        const { data, error } = await supabase
          .from('reflections')
          .insert(payload)
          .select('*')
          .single();

        if (error) throw error;
        setTodayRow(data as any);
      }
    } catch (e) {
      console.error('Failed to save reflection:', e);
    } finally {
      setSavingReflection(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl p-6 shadow-sm">読み込み中...</div>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">

      {/* ✅ 今日の行動しやすさ：昨日の目標を今日のトップに出す */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-blue-900">今日のやること（昨日の目標）</h3>
          <div className="text-xs text-blue-700">
            {yesterday} に設定
          </div>
        </div>

        {todayTodo.length === 0 ? (
          <p className="text-sm text-blue-800 mt-2">
            昨日の「行動目標」がまだありません。昨日の振り返りで行動目標を追加すると、ここに出ます。
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {todayTodo.map((item, idx) => (
              <label key={idx} className="flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!item.done}
                  onChange={() => toggleTodoDone(idx)}
                  disabled={savingTodo}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className={`text-sm ${item.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {item.text}
                  </div>
                  {item.done_at && (
                    <div className="text-xs text-gray-500">完了: {new Date(item.done_at).toLocaleString('ja-JP')}</div>
                  )}
                </div>
                {item.done && <CheckCircle className="h-4 w-4 text-green-600" />}
              </label>
            ))}

            <div className="text-xs text-blue-700 mt-2">
              {savingTodo ? '保存中…' : 'チェックすると即保存されます（完了保存）'}
            </div>
          </div>
        )}
      </div>

      {/* --- ここから下は「今日の振り返り」フォーム（例） --- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">今日の振り返り</h3>

        <div>
          <label className="text-sm text-gray-700">できたこと</label>
          <input
            value={did}
            onChange={(e) => setDid(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="例：早起きできた"
          />
        </div>

        <div>
          <label className="text-sm text-gray-700">できなかったこと</label>
          <input
            value={didnt}
            onChange={(e) => setDidnt(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="例：食べすぎた"
          />
        </div>

        <div>
          <label className="text-sm text-gray-700">メモ</label>
          <textarea
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            rows={3}
            placeholder="自由メモ"
          />
        </div>

        {/* ✅ 複数化：明日の行動目標 */}
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">明日の行動目標（複数）</h4>
            <button
              type="button"
              onClick={addTomorrowAction}
              className="text-sm px-3 py-1 rounded-lg bg-gray-900 text-white flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              追加
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {tomorrowActions.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={a.text}
                  onChange={(e) => updateTomorrowActionText(i, e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2"
                  placeholder="例：時間通りに食べる"
                />
                <button
                  type="button"
                  onClick={() => removeTomorrowAction(i)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            ここで設定した「明日の行動目標」は、翌日のカード上部に“今日のやること”として表示されます。
          </p>
        </div>

        <button
          onClick={saveTodayReflection}
          disabled={savingReflection}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 disabled:opacity-50"
        >
          {savingReflection ? '保存中…' : '今日の振り返りを保存'}
        </button>
      </div>
    </div>
  );
}