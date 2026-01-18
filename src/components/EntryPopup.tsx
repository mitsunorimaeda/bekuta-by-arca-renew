import React from "react";
import { X, Sparkles } from "lucide-react";

export type EntryPopupMode = "welcome_back" | "daily_one_word";

export function EntryPopup(props: {
  open: boolean;
  mode: EntryPopupMode;
  daysAway?: number;
  title?: string;
  message: string;

  okLabel?: string;     // ✅ 主ボタン文言
  closeLabel?: string;  // ✅ サブボタン文言

  onOk: () => void;     // ✅ OK（主ボタン）
  onClose: () => void;  // ✅ 閉じる（×/背景/サブボタン）
}) {
  const {
    open,
    mode,
    daysAway = 0,
    title,
    message,
    okLabel,
    closeLabel,
    onOk,
    onClose,
  } = props;

  if (!open) return null;

  const defaultTitle = mode === "welcome_back" ? "おかえりなさい" : "今日の一言";
  const defaultOkLabel = mode === "welcome_back" ? "今日はここから" : "OK";
  const defaultCloseLabel = "閉じる";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-16">
      {/* 背景クリックは閉じる */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl p-4">
        {/* ×ボタン＝閉じる */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="閉じる"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {title ?? defaultTitle}
            </p>

            {mode === "welcome_back" && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                最終ログインから {daysAway}日
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
          {message}
        </p>

        <div className="mt-4 flex gap-2">
          {/* 主ボタン＝OK */}
          <button
            type="button"
            onClick={onOk}
            className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold active:opacity-90"
          >
            {okLabel ?? defaultOkLabel}
          </button>

          {/* サブボタン＝閉じる */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200"
          >
            {closeLabel ?? defaultCloseLabel}
          </button>
        </div>
      </div>
    </div>
  );
}