import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

export function Toast({
  open,
  message,
  type = "success",
  durationMs = 1800,
  onClose,
}: {
  open: boolean;
  message: string;
  type?: ToastType;
  durationMs?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const isSuccess = type === "success";
  const isError = type === "error";

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-4">
      <div
        className={[
          "flex items-center gap-3 rounded-xl shadow-xl border px-4 py-3 w-[min(92vw,420px)]",
          "bg-white dark:bg-gray-900",
          isSuccess
            ? "border-green-200 dark:border-green-900/40"
            : isError
            ? "border-red-200 dark:border-red-900/40"
            : "border-gray-200 dark:border-gray-700",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : isError ? (
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}

        <div className="flex-1 text-sm text-gray-900 dark:text-gray-100">{message}</div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}