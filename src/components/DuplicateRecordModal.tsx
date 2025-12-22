import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ExistingMotivationRecord = {
  id: string;
  date: string;
  motivation_level: number;
  energy_level: number;
  stress_level: number;
  notes?: string | null;
  mood?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
  existingRecord: ExistingMotivationRecord;
  newValue: {
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    notes?: string;
  };
};

export function DuplicateMotivationRecordModal({
  isOpen,
  onClose,
  onOverwrite,
  onCancel,
  existingRecord,
  newValue
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              その日付の記録が既にあります
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            この日付には既に記録があります。上書きしますか？
          </p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">日付</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {new Date(existingRecord.date).toLocaleDateString('ja-JP')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">現在</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  意欲 {existingRecord.motivation_level} /10
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  体力 {existingRecord.energy_level} /10
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  ストレス {existingRecord.stress_level} /10
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">新規</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                  意欲 {newValue.motivation_level} /10
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                  体力 {newValue.energy_level} /10
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                  ストレス {newValue.stress_level} /10
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              上書きすると、既存データは更新されます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onOverwrite}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            上書きする
          </button>
        </div>
      </div>
    </div>
  );
}