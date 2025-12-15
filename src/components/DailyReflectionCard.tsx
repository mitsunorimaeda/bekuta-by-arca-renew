import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Save, Trash2, Loader2, Info } from 'lucide-react';
import { useDailyReflections } from '../hooks/useDailyReflections';

type Props = {
  userId: string;
  defaultExpanded?: boolean;
};

const MAX_CHARS = 800; // コスト/負担の上限（後で変更OK）

export function DailyReflectionCard({ userId, defaultExpanded = true }: Props) {
  const {
    selectedDate,
    setSelectedDate,
    reflection,
    loading,
    saving,
    error,
    save,
    remove,
  } = useDailyReflections(userId);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [text, setText] = useState('');

  // 取得したDB値をテキストに反映
  useEffect(() => {
    setText(reflection?.text ?? '');
  }, [reflection?.id, selectedDate]);

  const chars = text.length;
  const isOver = chars > MAX_CHARS;

  const canSave = useMemo(() => {
    if (loading || saving) return false;
    if (isOver) return false;
    // 空保存はさせない（削除は別ボタン）
    if (!text.trim()) return false;
    // 変更がないなら保存不要
    const current = reflection?.text ?? '';
    return text !== current;
  }, [loading, saving, isOver, text, reflection?.text]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">今日の振り返り</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              週次AIサマリーの材料になります（まずは保存だけ）
            </p>
          </div>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{expanded ? '閉じる' : '開く'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {/* Date */}
          <div className="flex items-center gap-2 py-3">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                         rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
            {(loading || saving) && (
              <span className="ml-2 inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                {loading ? '読込中' : '保存中'}
              </span>
            )}
          </div>

          {/* Text */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例）今日は練習の入りが重かった。睡眠が短かったので、明日は就寝を早める。"
            rows={6}
            className="w-full resize-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                       rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white
                       placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className={isOver ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                {chars}
              </span>
              /{MAX_CHARS}
              {isOver && <span className="ml-2">文字数が多すぎます</span>}
            </div>

            <div className="flex items-center gap-2">
              {reflection?.id && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('この日の振り返りを削除しますか？')) return;
                    await remove();
                  }}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                             border border-gray-200 dark:border-gray-600
                             text-gray-700 dark:text-gray-200
                             hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  削除
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await save(text.trim(), 'private');
                }}
                disabled={!canSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                           bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}