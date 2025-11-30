import React, { useState } from 'react';
import { TrainingRecord } from '../lib/supabase';
import { X, Save, Trash2, Calendar, Clock, Zap, AlertCircle } from 'lucide-react';

interface EditTrainingRecordModalProps {
  record: TrainingRecord;
  onClose: () => void;
  onUpdate: (recordId: string, data: { rpe: number; duration_min: number; date?: string }) => Promise<void>;
  onDelete?: (recordId: string) => Promise<void>;
  allowDateEdit?: boolean;
  allowDelete?: boolean;
}

export function EditTrainingRecordModal({ 
  record, 
  onClose, 
  onUpdate, 
  onDelete,
  allowDateEdit = false,
  allowDelete = false
}: EditTrainingRecordModalProps) {
  const [formData, setFormData] = useState({
    rpe: record.rpe,
    duration_min: record.duration_min,
    date: record.date
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updateData: { rpe: number; duration_min: number; date?: string } = {
        rpe: formData.rpe,
        duration_min: formData.duration_min,
      };

      if (allowDateEdit && formData.date !== record.date) {
        updateData.date = formData.date;
      }

      await onUpdate(record.id, updateData);
      onClose();
    } catch (err: any) {
      console.error('Error updating record:', err);
      setError(err.message || '更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setLoading(true);
    setError('');

    try {
      await onDelete(record.id);
      onClose();
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setError(err.message || '削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const rpeLabels = [
    '0 - まったく楽である',
    '1 - 非常に楽である',
    '2 - 楽である',
    '3 - 少しきつい',
    '4 - ややきつい',
    '5 - きつい',
    '6 - さらにきつい',
    '7 - とてもきつい',
    '8 - かなりきつい',
    '9 - 非常にきつい',
    '10 - 最大限にきつい (限界)'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 rounded-full p-2">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">練習記録を編集</h2>
                <p className="text-blue-100">
                  {new Date(record.date).toLocaleDateString('ja-JP')}の記録
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Current Values Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">現在の値</h3>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-gray-600">RPE</div>
                <div className="font-bold text-lg text-blue-600">{record.rpe}</div>
              </div>
              <div>
                <div className="text-gray-600">時間</div>
                <div className="font-bold text-lg text-green-600">{record.duration_min}分</div>
              </div>
              <div>
                <div className="text-gray-600">負荷</div>
                <div className="font-bold text-lg text-purple-600">{record.load}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Edit (if allowed) */}
            {allowDateEdit && (
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  練習日
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            )}

            {/* RPE Edit */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Zap className="w-4 h-4 mr-2" />
                RPE（運動強度）
              </label>
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.rpe}
                  onChange={(e) => setFormData(prev => ({ ...prev, rpe: Number(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    WebkitAppearance: 'none',
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(formData.rpe / 10) * 100}%, #9ca3af ${(formData.rpe / 10) * 100}%, #9ca3af 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{formData.rpe}</div>
                  <div className="text-sm text-blue-700">{rpeLabels[formData.rpe]}</div>
                </div>
              </div>
            </div>

            {/* Duration Edit */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Clock className="w-4 h-4 mr-2" />
                練習時間（分）
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={formData.duration_min}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_min: Number(e.target.value) }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base"
                style={{ fontSize: '16px' }} // Prevent zoom on iOS Safari
              />
            </div>

            {/* New Load Calculation */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">新しい負荷値</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formData.rpe * formData.duration_min}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>変更前: {record.load}</span>
                <span className={`font-medium ${
                  (formData.rpe * formData.duration_min) > record.load 
                    ? 'text-red-600' 
                    : (formData.rpe * formData.duration_min) < record.load 
                      ? 'text-blue-600' 
                      : 'text-gray-600'
                }`}>
                  {(formData.rpe * formData.duration_min) > record.load ? '増加' : 
                   (formData.rpe * formData.duration_min) < record.load ? '減少' : '変更なし'}
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {allowDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>削除</span>
                </button>
              )}
              
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {loading ? '更新中...' : '更新'}
              </button>
            </div>
          </form>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 rounded-2xl">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <div className="text-center">
                <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">記録を削除しますか？</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {new Date(record.date).toLocaleDateString('ja-JP')}の練習記録が完全に削除されます。
                  この操作は取り消せません。
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    削除する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}