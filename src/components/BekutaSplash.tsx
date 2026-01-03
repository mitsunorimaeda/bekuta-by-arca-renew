import React from "react";

export function BekutaSplash({ subtitle }: { subtitle?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center px-6">
        <div className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Bekuta
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {subtitle ?? "読み込み中…"}
        </div>

        {/* くるくる（地味に安心感） */}
        <div className="mt-6 flex justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-700 border-t-transparent animate-spin" />
        </div>
      </div>
    </div>
  );
}