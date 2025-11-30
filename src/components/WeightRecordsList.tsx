import React, { useState } from 'react';
import { Scale, Calendar, CreditCard as Edit2, Trash2, FileText } from 'lucide-react';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];

interface WeightRecordsListProps {
  records: WeightRecord[];
  onUpdate: (id: string, data: { weight_kg: number; notes?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export function WeightRecordsList({ records, onUpdate, onDelete, loading }: WeightRecordsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const handleEdit = (record: WeightRecord) => {
    setEditingId(record.id);
    setEditWeight(record.weight_kg.toString());
    setEditNotes(record.notes || '');
  };

  const handleSave = async (id: string) => {
    const weightNum = parseFloat(editWeight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum >= 500) {
      alert('体重は0〜500kgの範囲で入力してください。');
      return;
    }

    try {
      await onUpdate(id, {
        weight_kg: weightNum,
        notes: editNotes.trim() || undefined
      });
      setEditingId(null);
      setEditWeight('');
      setEditNotes('');
    } catch (error) {
      console.error('Error updating weight record:', error);
      alert('更新に失敗しました。');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditWeight('');
    setEditNotes('');
  };

  const handleDelete = async (id: string, date: string) => {
    if (confirm(`${new Date(date).toLocaleDateString('ja-JP')}の記録を削除しますか？`)) {
      try {
        await onDelete(id);
      } catch (error) {
        console.error('Error deleting weight record:', error);
        alert('削除に失敗しました。');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <Scale className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">体重記録がありません</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">上のフォームから記録を追加してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">体重記録履歴</h3>
      <div className="space-y-3">
        {records.map((record) => (
          <div
            key={record.id}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors"
          >
            {editingId === record.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      測定日
                    </label>
                    <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(record.date).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      体重（kg）
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="499"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-800 dark:text-white"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                    メモ
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-800 dark:text-white resize-none"
                    rows={2}
                    maxLength={500}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSave(record.id)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(record.date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex items-center">
                    <Scale className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {record.weight_kg}
                    </span>
                    <span className="text-lg text-gray-600 dark:text-gray-400 ml-1">kg</span>
                  </div>
                  {record.notes && (
                    <div className="flex items-start text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <FileText className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="whitespace-pre-wrap">{record.notes}</span>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(record)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id, record.date)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
