// src/components/DailyReflectionCard.tsx
import React, { useMemo, useState } from 'react';
import { CalendarCheck, PencilLine, Trophy, Tags } from 'lucide-react';
import { getTodayJSTString } from '../lib/date';
import { useReflections } from '../hooks/useReflections';
import { ReflectionModal } from './ReflectionModal';
import { WeeklyReflectionSummary } from './WeeklyReflectionSummary';

// もし toast があるならここを有効化（無ければ下の addToast 部分はコメントでOK）
// import { useToast } from '../hooks/useToast';

type Props = {
  userId: string;
};

export function DailyReflectionCard({ userId }: Props) {
  // const { addToast } = useToast(); // あなたの実装に合わせて名称調整

  const today = getTodayJSTString(); // 既存utilを利用
  const { todayReflection, weekReflections, upsertReflection, loading } = useReflections(userId);

  const [open, setOpen] = useState(false);

  const statusLabel = useMemo(() => {
    if (loading) return '読み込み中...';
    return todayReflection ? '入力済み' : '未入力';
  }, [loading, todayReflection]);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors border border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">今日の振り返り</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {today} / {statusLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PencilLine className="w-4 h-4" />
            {todayReflection ? '編集' : '書く'}
          </button>
        </div>

        {/* 入力済みのプレビュー */}
        {todayReflection && (
          <div className="mt-4 space-y-3 text-sm">
            {todayReflection.did && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">できたこと</div>
                <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {todayReflection.did}
                </div>
              </div>
            )}

            {todayReflection.next_action && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">次の一手</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {todayReflection.next_action}
                </div>
              </div>
            )}

            {(todayReflection.cause_tags?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <Tags className="w-3 h-3" />
                  原因タグ
                </div>
                <div className="flex flex-wrap gap-2">
                  {todayReflection.cause_tags.map((t: string) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* “やったら得” */}
        <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Trophy className="w-4 h-4" />
            保存で +5pt（任意・でも得）
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm text-blue-700 dark:text-blue-300 font-semibold hover:underline"
          >
            {todayReflection ? '追記する' : '今書く'}
          </button>
        </div>

        {/* 週次まとめ */}
        <div className="mt-6">
          <WeeklyReflectionSummary reflections={weekReflections} />
        </div>
      </div>

      <ReflectionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initial={todayReflection}
        onSubmit={async (payload) => {
          await upsertReflection({
            reflection_date: today,
            did: payload.did,
            didnt: payload.didnt,
            cause_tags: payload.cause_tags,
            next_action: payload.next_action,
            free_note: payload.free_note,
            award: true,
            award_points: 5,
            metadata: { source: 'daily_reflection_card' },
          });

          // toast があるならここで通知
          // addToast?.({ type: 'success', title: '保存完了', message: '振り返りを保存しました（+5pt）' });

          setOpen(false);
        }}
      />
    </>
  );
}