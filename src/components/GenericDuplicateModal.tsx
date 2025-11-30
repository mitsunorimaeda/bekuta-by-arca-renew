import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface GenericDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
  title: string;
  date: string;
  existingValues: { label: string; value: string }[];
  newValues: { label: string; value: string }[];
}

export function GenericDuplicateModal({
  isOpen,
  onClose,
  onOverwrite,
  onCancel,
  title,
  date,
  existingValues,
  newValues
}: GenericDuplicateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              データが既に存在します
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            この日付には既にデータが入力されています。上書きしますか？
          </p>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">記録タイプ</p>
                <p className="text-base text-gray-900 dark:text-white">{title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">日付</p>
                <p className="text-base text-gray-900 dark:text-white">
                  {new Date(date).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">現在の値</p>
                  <div className="space-y-1">
                    {existingValues.map((item, index) => (
                      <div key={index}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">新しい値</p>
                  <div className="space-y-1">
                    {newValues.map((item, index) => (
                      <div key={index}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              上書きすると、現在のデータは削除されます。この操作は取り消せません。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
