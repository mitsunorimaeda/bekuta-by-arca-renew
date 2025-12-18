import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';

/* =========================
   Types
========================= */
type ActionItem = {
  text: string;
  done: boolean;
  done_at: string | null;
};

type ReflectionRow = {
  id: string;
  user_id: string;
  reflection_date: string; // YYYY-MM-DD
  did: string | null;
  didnt: string | null;
  cause_tags: string[] | null;
  next_action: string | null;
  next_action_items: ActionItem[] | null;
  free_note: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

/* =========================
   Date helpers (JST)
========================= */
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

function getStartOfWeekJSTString() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7;
  jst.setDate(jst.getDate() - diffToMonday);
  jst.setHours(0, 0, 0, 0);
  return jst.toISOString().slice(0, 10);
}

/* =========================
   Utils
========================= */
function normalizeActionItems(row?: ReflectionRow | null): ActionItem[] {
  if (!row) return [];
  const items = row.next_action_items ?? [];
  if (Array.isArray(items) && items.length > 0) return items;

  if (row.next_action && row.next_action.trim()) {
    return [{ text: row.next_action.trim(), done: false, done_at: null }];
  }
  return [];
}

/* =========================
   Component
========================= */
export function DailyReflectionCard() {
  const today = useMemo(() => getTodayJSTString(), []);
  const yesterday = useMemo(() => getYesterdayJSTString(), []);
  const weekStart = useMemo(() => getStartOfWeekJSTString(), []);

  const [loading, setLoading] = useState(true);

  const [todayRow, setTodayRow] = useState<ReflectionRow | null>(null);
  const [yesterdayRow, setYesterdayRow] = useState<ReflectionRow | null>(null);
  const [weekRows, setWeekRows] = useState<ReflectionRow[]>([]);

  const [todayTodo, setTodayTodo] = useState<ActionItem[]>([]);
  const [tomorrowActions, setTomorrowActions] = useState<ActionItem[]>([
    { text: '', done: false, done_at: null },
  ]);

  const [did, setDid] = useState('');
  const [didnt, setDidnt] = useState('');
  const [causeTags, setCauseTags] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');

  const [savingTodo, setSavingTodo] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  /* =========================
     Initial load
  ========================= */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        // 今日・昨日
        const { data: daily } = await supabase
          .from('reflections')
          .select('*')
          .eq('user_id', userId)
          .in('reflection_date', [today, yesterday]);

        const t = daily?.find((r) => r.reflection_date === today) ?? null;
        const y = daily?.find((r) => r.reflection_date === yesterday) ?? null;

        setTodayRow(t as any);
        setYesterdayRow(y as any);
        setTodayTodo(normalizeActionItems(y as any));

        if (t) {
          setDid(t.did ?? '');
          setDidnt(t.didnt ?? '');
          setCauseTags(t.cause_tags ?? []);
          setFreeNote(t.free_note ?? '');
          const items = normalizeActionItems(t as any);
          setTomorrowActions(items.length ? items : [{ text: '', done: false, done_at: null }]);
        }

        // 今週
        const { data: week } = await supabase
          .from('reflections')
          .select('id, reflection_date, did, didnt, cause_tags')
          .eq('user_id', userId)
          .gte('reflection_date', weekStart)
          .lte('reflection_date', today)
          .order('reflection_date', { ascending: true });

        setWeekRows((week || []) as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today, yesterday, weekStart]);

  /* =========================
     Weekly summary
  ========================= */
  const weeklySummary = useMemo(() => {
    const didCount = weekRows.filter((r) => r.did?.trim()).length;
    const didntCount = weekRows.filter((r) => r.didnt?.trim()).length;

    const tagCount: Record<string, number> = {};
    weekRows.forEach((r) =>
      (r.cause_tags ?? []).forEach((t) => {
        tagCount[t] = (tagCount[t] ?? 0) + 1;
      })
    );

    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { didCount, didntCount, topTags };
  }, [weekRows]);

  /* =========================
     Todo toggle
  ========================= */
  const toggleTodoDone = async (index: number) => {
    if (!yesterdayRow) return;
    const next = [...todayTodo];
    const t = next[index];
    if (!t) return;

    const now = new Date().toISOString();
    next[index] = { ...t, done: !t.done, done_at: !t.done ? now : null };
    setTodayTodo(next);

    setSavingTodo(true);
    try {
      await supabase
        .from('reflections')
        .update({
          next_action_items: next,
          next_action: next[0]?.text ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', yesterdayRow.id);
    } finally {
      setSavingTodo(false);
    }
  };

  /* =========================
     Save today reflection
  ========================= */
  const saveTodayReflection = async () => {
    setSavingReflection(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const actions = tomorrowActions
        .map((a) => ({ ...a, text: a.text.trim() }))
        .filter((a) => a.text);

      const payload = {
        user_id: userId,
        reflection_date: today,
        did: did.trim(),
        didnt: didnt.trim(),
        cause_tags: causeTags,
        free_note: freeNote.trim(),
        next_action_items: actions,
        next_action: actions[0]?.text ?? null,
        metadata: { source: 'daily_reflection_card' },
        updated_at: new Date().toISOString(),
      };

      if (todayRow?.id) {
        await supabase.from('reflections').update(payload).eq('id', todayRow.id);
      } else {
        await supabase.from('reflections').insert(payload);
      }
    } finally {
      setSavingReflection(false);
    }
  };

  if (loading) return <div className="bg-white rounded-xl p-6">読み込み中…</div>;

  /* =========================
     Render
  ========================= */
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">

      {/* 今週の傾向 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-900">今週の傾向</h3>
        <div className="text-sm mt-1">
          できた：{weeklySummary.didCount} ／ できなかった：{weeklySummary.didntCount}
        </div>

        <div className="mt-3 space-y-2">
          {weeklySummary.topTags.length === 0 && (
            <div className="text-sm text-amber-800">まだ原因タグがありません</div>
          )}
          {weeklySummary.topTags.map(([tag, count]) => (
            <div key={tag} className="flex items-center gap-2">
              <div className="w-24 text-sm">{tag}</div>
              <div className="flex-1 h-2 bg-amber-100 rounded">
                <div className="h-2 bg-amber-400 rounded" style={{ width: `${count * 20}%` }} />
              </div>
              <div className="text-xs">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 今日の振り返り */}
      <div className="space-y-3">
        <h3 className="font-semibold">今日の振り返り</h3>

        <input
          value={did}
          onChange={(e) => setDid(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="できたこと"
        />

        <input
          value={didnt}
          onChange={(e) => setDidnt(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="できなかったこと"
        />

        {/* 原因タグ */}
        <div className="flex flex-wrap gap-2">
          {['栄養', '睡眠', '時間管理', '習慣', 'メンタル', '環境'].map((tag) => (
            <button
              key={tag}
              onClick={() =>
                setCauseTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]))
              }
              className={`px-3 py-1 rounded-full text-xs border ${
                causeTags.includes(tag)
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <textarea
          value={freeNote}
          onChange={(e) => setFreeNote(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={3}
          placeholder="自由メモ"
        />

        <button
          onClick={saveTodayReflection}
          disabled={savingReflection}
          className="w-full bg-blue-600 text-white rounded-lg py-3"
        >
          {savingReflection ? '保存中…' : '今日の振り返りを保存'}
        </button>
      </div>
    </div>
  );
}