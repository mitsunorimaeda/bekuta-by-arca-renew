import React, { useState, useMemo, useCallback } from 'react';
import { TrainingRecord } from '../lib/supabase';
import { EditTrainingRecordModal } from './EditTrainingRecordModal';
import { Calendar, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface TrainingRecordsListProps {
  records: TrainingRecord[];
  onUpdate: (recordId: string, data: { rpe: number; duration_min: number; date?: string }) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
  loading?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowDateEdit?: boolean;
  showLimited?: boolean;
  limitCount?: number;
}

export const TrainingRecordsList = React.memo(function TrainingRecordsList({
  records,
  onUpdate,
  onDelete,
  loading = false,
  allowEdit = true,
  allowDelete = false,
  allowDateEdit = false,
  showLimited = false,
  limitCount = 10
}: TrainingRecordsListProps) {
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const displayRecords = useMemo(
    () => (showLimited && !showAll ? records.slice(-limitCount) : records),
    [records, showLimited, showAll, limitCount]
  );

  const sortedRecords = useMemo(
    () => [...displayRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [displayRecords]
  );

  const handleEditClick = useCallback((record: TrainingRecord) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowEditModal(false);
    setSelectedRecord(null);
  }, []);

  const rpeColor = (rpe: number) =>
    rpe >= 8
      ? 'text-red-600 dark:text-red-400'
      : rpe >= 6
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-green-600 dark:text-green-400';

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">練習記録がありません</h3>
        <p className="text-gray-600 dark:text-gray-400">最初の練習記録を追加してみましょう。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">練習記録</h3>

        {showLimited && records.length > limitCount && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
          >
            <span>{showAll ? `最新${limitCount}件のみ表示` : `全${records.length}件を表示`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Records List */}
      <div className="space-y-3">
        {sortedRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
          >
            {/* Mobile Layout */}
            <div className="block sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(record.date).toLocaleDateString('ja-JP')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="text-gray-600 dark:text-gray-400 text-xs">RPE</div>
                      <div className={`font-bold ${rpeColor(record.rpe)}`}>{record.rpe}</div>
                    </div>

                    <div className="text-center">
                      <div className="text-gray-600 dark:text-gray-400 text-xs">時間</div>
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        {record.duration_min}分
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-gray-600 dark:text-gray-400 text-xs">負荷</div>
                      <div className="font-bold text-purple-600 dark:text-purple-400">{record.load}</div>
                    </div>
                  </div>
                </div>

                {allowEdit && (
                  <button
                    onClick={() => handleEditClick(record)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 p-2 rounded-lg transition-colors ml-2"
                    title="編集"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex-1 grid grid-cols-4 gap-6">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(record.date).toLocaleDateString('ja-JP')}
                  </span>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">RPE</div>
                  <div className={`text-xl font-bold ${rpeColor(record.rpe)}`}>{record.rpe}</div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">時間</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {record.duration_min}分
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">負荷</div>
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{record.load}</div>
                </div>
              </div>

              {allowEdit && (
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEditClick(record)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 p-2 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {allowDelete && (
                    <button
                      onClick={() => handleEditClick(record)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-300 p-2 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show More/Less Button for Limited View */}
      {showLimited && records.length > limitCount && !showAll && (
        <div className="text-center pt-4">
          <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium" onClick={() => setShowAll(true)}>
            さらに{records.length - limitCount}件の記録を表示
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRecord && (
        <EditTrainingRecordModal
          record={selectedRecord}
          onClose={handleModalClose}
          onUpdate={onUpdate}
          onDelete={allowDelete ? onDelete : undefined}
          allowDateEdit={allowDateEdit}
          allowDelete={allowDelete}
        />
      )}
    </div>
  );
});