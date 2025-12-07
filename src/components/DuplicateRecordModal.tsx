import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { PerformanceRecordWithTest } from '../hooks/usePerformanceData';

interface DuplicateRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
  existingRecord: PerformanceRecordWithTest;
  newValue: number;
}

export function DuplicateRecordModal({
  isOpen,
  onClose,
  onOverwrite,
  onCancel,
  existingRecord,
  newValue
}: DuplicateRecordModalProps) {
  if (!isOpen) return null;

  const formatValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num.toFixed(2);
    }
    return String(value);
  };

  const existingValue = existingRecord.values.primary_value;
  const unit = existingRecord.test_type?.unit || '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              データが既に存在します
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-4">
            この日付には既にデータが入力されています。上書きしますか？
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">測定種目</p>
                <p className="text-base text-gray-900">
                  {existingRecord.test_type?.display_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">日付</p>
                <p className="text-base text-gray-900">
                  {new Date(existingRecord.date).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">現在の値</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatValue(existingValue)} {unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">新しい値</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {formatValue(newValue)} {unit}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              上書きすると、現在のデータは削除されます。この操作は取り消せません。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
