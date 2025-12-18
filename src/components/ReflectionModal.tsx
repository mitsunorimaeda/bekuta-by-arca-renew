// src/components/ReflectionModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Tags, PenLine } from 'lucide-react';
import type { Reflection } from '../hooks/useReflections';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    did: string;
    didnt: string;
    cause_tags: string[];
    next_action: string;
    free_note: string;
  }) => Promise<void>;
  initial?: Reflection | null;
};

const PRESET_TAGS = [
  '睡眠',
  '栄養',
  '練習量',
  '強度',
  'メンタル',
  '時間管理',
  '痛み/違和感',
  '集中',
  '回復',
  '習慣',
];

export function ReflectionModal({ isOpen, onClose, onSubmit, initial }: Props) {
  const [did, setDid] = useState('');
  const [didnt, setDidnt] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [freeNote, setFreeNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDid(initial?.did ?? '');
    setDidnt(initial?.didnt ?? '');
    setNextAction(initial?.next_action ?? '');
    setFreeNote(initial?.free_note ?? '');
    setTags(initial?.cause_tags ?? []);
  }, [isOpen, initial]);

  const canSave = useMemo(() => {
    // “強制ではない”前提：最低限、どれか1つ入ってればOK
    return (
      did.trim().length > 0 ||
      didnt.trim().length > 0 ||
      nextAction.trim().length > 0 ||
      freeNote.trim().length > 0 ||
      tags.length > 0
    );
  }, [did, didnt, nextAction, freeNote, tags]);

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">今日の振り返り</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              書いたら得。あとで見返して成長実感。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <CheckCircle2 className="w-4 h-4" />
              できたこと（良かった点）
            </label>
            <textarea
              value={did}
              onChange={(e) => setDid(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：練習前の補食ができた / 切り替えが早かった"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <PenLine className="w-4 h-4" />
              うまくいかなかったこと（改善点）
            </label>
            <textarea
              value={didnt}
              onChange={(e) => setDidnt(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：睡眠が短かった / 練習中に集中が切れた"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <Tags className="w-4 h-4" />
              原因タグ（分析しやすくする）
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              タグは後で「原因別に集計」できるようになる。
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              次の一手（明日の具体行動）
            </label>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：就寝を23:30固定 / 練習前にバナナ＋ヨーグルト"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              自由メモ（任意）
            </label>
            <textarea
              value={freeNote}
              onChange={(e) => setFreeNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：今日は◯◯がしんどかった / でも最後は踏ん張れた"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            保存すると <span className="font-semibold text-gray-700 dark:text-gray-200">+5pt</span>（お祝い）
          </div>
          <button
            disabled={!canSave || saving}
            onClick={async () => {
              if (!canSave || saving) return;
              try {
                setSaving(true);
                await onSubmit({
                  did,
                  didnt,
                  cause_tags: tags,
                  next_action: nextAction,
                  free_note: freeNote,
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={`px-4 py-2 rounded-xl font-semibold text-white transition-all ${
              !canSave || saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
            }`}
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}