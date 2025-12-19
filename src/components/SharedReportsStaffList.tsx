import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, User, StickyNote } from 'lucide-react';

type Row = {
  id: string;
  user_id: string;
  note: string | null;
  created_at: string;
  users?: { id: string; name: string } | null;
};

function formatJp(dt: string) {
  const d = new Date(dt);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function SharedReportsStaffList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shared_reports')
        .select('id, user_id, note, created_at, users (id, name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data as any) || []);
    } catch (e) {
      console.error('[SharedReportsStaffList] load failed:', e);
      alert('共有一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          共有された選手（最新）
        </div>
        <button
          onClick={load}
          className="text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          更新
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          読み込み中...
        </div>
      )}

      {empty && (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          共有はまだありません。
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {r.users?.name ?? '（名前不明）'}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatJp(r.created_at)}
                </div>
              </div>

              {r.note && (
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 flex gap-2">
                  <StickyNote className="w-4 h-4 mt-0.5 text-gray-400" />
                  <p className="leading-relaxed">{r.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}