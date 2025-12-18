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

/**
 * weekOffset:
 *  0 = 今週
 * -1 = 先週
 * -2 = 先々週 ...
 */
function getStartOfWeekJSTString(weekOffset = 0) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7; // Mon=0
  jst.setDate(jst.getDate() - diffToMonday + weekOffset * 7);
  jst.setHours(0, 0, 0, 0);
  return jst.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

const CAUSE_TAG_OPTIONS = [
  // 身体・生理
  '栄養',
  '睡眠',
  '体調',
  '疲労',
  '痛み',

  // トレーニング・競技
  'トレーニング負荷',
  '試合・連戦',
  '移動',
  '用具',

  // メンタル・認知
  'メンタル',
  '集中',
  'モチベーション',

  // 生活・環境
  '時間管理',
  '学業',
  '人間関係',
  '環境',
  'ルーティン',
];

export function DailyReflectionCard() {
  const today = useMemo(() => getTodayJSTString(), []);
  const yesterday = useMemo(() => getYesterdayJSTString(), []);

  // ✅ 週切り替え（週次集計だけ）
  const [weekOffset, setWeekOffset] = useState(0);
  const selectedWeekStart = useMemo(() => getStartOfWeekJSTString(weekOffset), [weekOffset]);
  const selectedWeekEnd = useMemo(() => addDays(selectedWeekStart, 6), [selectedWeekStart]);

  const [loading, setLoading] = useState(true);

  // 今日の reflection（入力・保存対象）
  const [todayRow, setTodayRow] = useState<ReflectionRow | null>(null);

  // 昨日の reflection（＝今日やることの“出どころ”）
  const [yesterdayRow, setYesterdayRow] = useState<ReflectionRow | null>(null);

  // 選択中の週の reflection（週次集計用）
  const [weekRows, setWeekRows] = useState<ReflectionRow[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

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

  // ✅ 初期ロード：今日・昨日だけ（週は別effectで取る）
  useEffect(() => {
    const loadDaily = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

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
          setTomorrowActions([{ text: '', done: false, done_at: null }]);
        }
      } catch (e) {
        console.error('Failed to load reflections (daily):', e);
      } finally {
        setLoading(false);
      }
    };

    loadDaily();
  }, [today, yesterday]);

  // ✅ 週次ロード：選択中の週が変わるたびに再取得
  useEffect(() => {
    const loadWeek = async () => {
      setWeekLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const weekEndExclusive = addDays(selectedWeekStart, 7);

        const { data, error } = await supabase
          .from('reflections')
          .select('id, user_id, reflection_date, did, didnt, cause_tags, next_action_items')
          .eq('user_id', userId)
          .gte('reflection_date', selectedWeekStart)
          .lt('reflection_date', weekEndExclusive)
          .order('reflection_date', { ascending: true });

        if (error) throw error;
        setWeekRows((data || []) as any);
      } catch (e) {
        console.error('Failed to load reflections (week):', e);
      } finally {
        setWeekLoading(false);
      }
    };

    loadWeek();
  }, [selectedWeekStart]);

  // ✅ 週次サマリー（原因タグ + 行動目標×完了率）
  const weeklySummary = useMemo(() => {
    const didCount = weekRows.filter((r) => (r.did ?? '').trim().length > 0).length;
    const didntCount = weekRows.filter((r) => (r.didnt ?? '').trim().length > 0).length;

    // cause_tags
    const tagCount: Record<string, number> = {};
    weekRows.forEach((r) => {
      (r.cause_tags ?? []).forEach((t) => {
        const key = (t ?? '').trim();
        if (!key) return;
        tagCount[key] = (tagCount[key] ?? 0) + 1;
      });
    });
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // 行動目標 × 完了率
    let goals = 0;
    let done = 0;

    const goalStats: Record<string, { total: number; done: number }> = {};

    weekRows.forEach((r) => {
      const items = r.next_action_items ?? [];
      items.forEach((a) => {
        const text = (a?.text ?? '').trim();
        if (!text) return;

        goals += 1;
        if (a.done) done += 1;

        goalStats[text] = goalStats[text] ?? { total: 0, done: 0 };
        goalStats[text].total += 1;
        if (a.done) goalStats[text].done += 1;
      });
    });

    const completionRate = goals ? Math.round((done / goals) * 100) : 0;

    const topGoals = Object.entries(goalStats)
      .map(([text, s]) => ({
        text,
        total: s.total,
        done: s.done,
        rate: s.total ? Math.round((s.done / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return {
      didCount,
      didntCount,
      topTags,
      goals,
      done,
      completionRate,
      topGoals,
      days: weekRows.length,
    };
  }, [weekRows]);

  // 今日やること（昨日の目標）を完了保存
  const toggleTodoDone = async (index: number) => {
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

    setTodayTodo(next);

    setSavingTodo(true);
    try {
      const { error } = await supabase
        .from('reflections')
        .update({
          next_action_items: next,
          next_action: next[0]?.text ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', yesterdayRow.id);

      if (error) throw error;

      setYesterdayRow((prev) =>
        prev ? { ...prev, next_action_items: next, next_action: next[0]?.text ?? null } : prev
      );

      // ✅ もし「昨日」が選択中の週に含まれていれば週次も即反映
      setWeekRows((prev) =>
        prev.map((r) => (r.id === yesterdayRow.id ? ({ ...r, next_action_items: next } as any) : r))
      );
    } catch (e) {
      console.error('Failed to save todo:', e);
      setTodayTodo(normalizeActionItems(yesterdayRow));
    } finally {
      setSavingTodo(false);
    }
  };

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

  const toggleCauseTag = (tag: string) => {
    setCauseTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // 今日の振り返り保存（明日の行動目標＝複数化して保存）
  const saveTodayReflection = async () => {
    setSavingReflection(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

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
        next_action_items: cleanedActions,
        next_action: cleanedActions[0]?.text ?? null,
        metadata: { source: 'daily_reflection_card' },
        updated_at: new Date().toISOString(),
      };

      if (todayRow?.id) {
        const { error } = await supabase.from('reflections').update(payload).eq('id', todayRow.id);
        if (error) throw error;

        setTodayRow((prev) => (prev ? ({ ...prev, ...payload } as any) : prev));

        // ✅ 今日が選択中の週に含まれていれば週次も即反映
        setWeekRows((prev) => prev.map((r) => (r.id === todayRow.id ? ({ ...r, ...payload } as any) : r)));
      } else {
        const { data, error } = await supabase.from('reflections').insert(payload).select('*').single();
        if (error) throw error;

        setTodayRow(data as any);

        // ✅ 今日が選択中の週に含まれていれば週次に追加
        if (today >= selectedWeekStart && today <= selectedWeekEnd) {
          setWeekRows((prev) => {
            const minimal: any = {
              id: data.id,
              user_id: data.user_id,
              reflection_date: data.reflection_date,
              did: data.did,
              didnt: data.didnt,
              cause_tags: data.cause_tags ?? payload.cause_tags,
              next_action_items: data.next_action_items ?? payload.next_action_items,
            };
            const filtered = prev.filter((r) => r.id !== minimal.id);
            return [...filtered, minimal].sort((a, b) => a.reflection_date.localeCompare(b.reflection_date));
          });
        }
      }
    } catch (e) {
      console.error('Failed to save reflection:', e);
    } finally {
      setSavingReflection(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl p-6 shadow-sm bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6 shadow-sm space-y-6 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">

      {/* ✅ 週切り替え付き：週の傾向 */}
      <div className="rounded-lg border p-4
        border-amber-200 bg-amber-50 text-amber-950
        dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100
      ">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">週の傾向</h3>
            <div className="text-xs mt-1 text-amber-800 dark:text-amber-200/80">
              {selectedWeekStart} 〜 {selectedWeekEnd}（{weeklySummary.days}日分）
              {weekLoading && <span className="ml-2">読み込み中…</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v - 1)}
              className="
                text-xs px-3 py-1 rounded-lg border
                border-amber-300 bg-white hover:bg-amber-100
                dark:border-amber-900/60 dark:bg-gray-950 dark:hover:bg-gray-800
              "
            >
              ＜ 先週
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="
                text-xs px-3 py-1 rounded-lg border
                border-amber-300 bg-white hover:bg-amber-100 disabled:opacity-50
                dark:border-amber-900/60 dark:bg-gray-950 dark:hover:bg-gray-800
              "
            >
              今週へ戻る
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm">
          できた：{weeklySummary.didCount}件 ／ できなかった：{weeklySummary.didntCount}件
        </div>

        <div className="mt-1 text-sm">
          行動目標：{weeklySummary.goals}件 ／ 完了：{weeklySummary.done}件（{weeklySummary.completionRate}%）
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold text-amber-800 dark:text-amber-200/80">原因タグ TOP3</div>
          {weeklySummary.topTags.length === 0 ? (
            <div className="text-sm text-amber-800 dark:text-amber-200/80">まだ原因タグがありません</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {weeklySummary.topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="
                    px-3 py-1 rounded-full text-xs border
                    border-amber-200 bg-white text-amber-950
                    dark:border-amber-900/60 dark:bg-gray-950 dark:text-amber-100
                  "
                >
                  {tag}：{count}
                </span>
              ))}
            </div>
          )}
        </div>

        {weeklySummary.topGoals.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold text-amber-800 dark:text-amber-200/80">
              よく立てる行動目標 TOP3
            </div>
            {weeklySummary.topGoals.map((g) => (
              <div key={g.text} className="flex items-center justify-between gap-3">
                <div className="text-sm flex-1">{g.text}</div>
                <div className="text-xs text-amber-800 dark:text-amber-200/80 w-28 text-right">
                  {g.done}/{g.total}（{g.rate}%）
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ 今日のやること（昨日の目標） */}
      <div className="rounded-lg border p-4
        border-blue-200 bg-blue-50 text-blue-950
        dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100
      ">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">今日のやること（昨日の目標）</h3>
          <div className="text-xs text-blue-700 dark:text-blue-200/80">{yesterday} に設定</div>
        </div>

        {todayTodo.length === 0 ? (
          <p className="text-sm text-blue-800 dark:text-blue-200/80 mt-2">
            昨日の「行動目標」がまだありません。昨日の振り返りで行動目標を追加すると、ここに出ます。
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {todayTodo.map((item, idx) => (
              <label
                key={idx}
                className="
                  flex items-center gap-3 rounded-lg px-3 py-2 border
                  bg-white border-blue-200
                  dark:bg-gray-950 dark:border-blue-900/50
                "
              >
                <input
                  type="checkbox"
                  checked={!!item.done}
                  onChange={() => toggleTodoDone(idx)}
                  disabled={savingTodo}
                  className="h-4 w-4 accent-green-600"
                />
                <div className="flex-1">
                  <div className={`text-sm ${item.done ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {item.text}
                  </div>
                  {item.done_at && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      完了: {new Date(item.done_at).toLocaleString('ja-JP')}
                    </div>
                  )}
                </div>
                {item.done && <CheckCircle className="h-4 w-4 text-green-600" />}
              </label>
            ))}

            <div className="text-xs text-blue-700 dark:text-blue-200/80 mt-2">
              {savingTodo ? '保存中…' : 'チェックすると即保存されます（完了保存）'}
            </div>
          </div>
        )}
      </div>

      {/* --- 今日の振り返りフォーム --- */}
      <div className="space-y-3">
        <h3 className="font-semibold">今日の振り返り</h3>

        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300">できたこと</label>
          <input
            value={did}
            onChange={(e) => setDid(e.target.value)}
            className="
              w-full border rounded-lg px-3 py-2
              bg-white text-gray-900 border-gray-300 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
              dark:bg-gray-950 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500
              dark:focus:ring-green-500 dark:focus:border-green-500
            "
            placeholder="例：強度高めの練習を最後までやり切れた"
          />
        </div>

        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300">できなかったこと</label>
          <input
            value={didnt}
            onChange={(e) => setDidnt(e.target.value)}
            className="
              w-full border rounded-lg px-3 py-2
              bg-white text-gray-900 border-gray-300 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
              dark:bg-gray-950 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500
              dark:focus:ring-green-500 dark:focus:border-green-500
            "
            placeholder="例：睡眠時間を確保できなかった"
          />
        </div>

        {/* ✅ 原因タグ */}
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300">原因タグ</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CAUSE_TAG_OPTIONS.map((tag) => {
              const active = causeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleCauseTag(tag)}
                  className={`
                    px-3 py-1 rounded-full text-xs border transition
                    ${active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
                    dark:${active
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-gray-900 text-gray-50 border-gray-700 hover:bg-gray-800'}
                  `}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            「できなかった」の主因を仮説でOK。週の傾向に集計されます。
          </p>
        </div>

        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300">メモ</label>
          <textarea
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
            className="
              w-full border rounded-lg px-3 py-2
              bg-white text-gray-900 border-gray-300 placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
              dark:bg-gray-950 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500
              dark:focus:ring-green-500 dark:focus:border-green-500
            "
            rows={3}
            placeholder="自由メモ"
          />
        </div>

        {/* ✅ 複数化：明日の行動目標 */}
        <div className="rounded-lg border p-4 border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">明日の行動目標（複数）</h4>
            <button
              type="button"
              onClick={addTomorrowAction}
              className="
                text-sm px-3 py-1 rounded-lg flex items-center gap-2
                bg-gray-900 text-white hover:bg-gray-800
                dark:bg-green-600 dark:hover:bg-green-700
              "
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
                  className="
                    flex-1 border rounded-lg px-3 py-2
                    bg-white text-gray-900 border-gray-300 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                    dark:bg-gray-950 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500
                    dark:focus:ring-green-500 dark:focus:border-green-500
                  "
                  placeholder="例：ストレッチを10分間行う"
                />
                <button
                  type="button"
                  onClick={() => removeTomorrowAction(i)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            ここで設定した「明日の行動目標」は、翌日のカード上部に“今日のやること”として表示されます。
          </p>
        </div>

        <button
          onClick={saveTodayReflection}
          disabled={savingReflection}
          className="
            w-full rounded-lg px-4 py-3 font-medium
            bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            dark:focus:ring-offset-gray-900
          "
        >
          {savingReflection ? '保存中…' : '今日の振り返りを保存'}
        </button>
      </div>
    </div>
  );
}