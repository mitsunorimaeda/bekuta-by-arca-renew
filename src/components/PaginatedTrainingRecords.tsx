import React from 'react';
import { TrainingRecord } from '../lib/supabase';
import { PaginatedTable } from './PaginatedTable';
import { Calendar, Clock, Zap } from 'lucide-react';

interface PaginatedTrainingRecordsProps {
  records: TrainingRecord[];
  loading?: boolean;
}

export function PaginatedTrainingRecords({ records, loading }: PaginatedTrainingRecordsProps) {
  const renderHeader = () => (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          日付
        </div>
        <div className="flex items-center">
          <Zap className="w-4 h-4 mr-2" />
          RPE
        </div>
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          時間
        </div>
        <div>負荷</div>
      </div>
    </div>
  );

  const renderRecord = (record: TrainingRecord, index: number) => (
    <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="font-medium text-gray-900">
          {new Date(record.date).toLocaleDateString('ja-JP')}
        </div>
        <div className="text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            record.rpe >= 8 ? 'bg-red-100 text-red-800' :
            record.rpe >= 6 ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {record.rpe}
          </span>
        </div>
        <div className="text-center text-gray-600">
          {record.duration_min}分
        </div>
        <div className="text-center font-semibold text-gray-900">
          {record.load}
        </div>
      </div>
    </div>
  );

  return (
    <PaginatedTable
      data={records}
      itemsPerPage={20}
      renderHeader={renderHeader}
      renderItem={renderRecord}
      loading={loading}
      emptyMessage="練習記録がありません"
    />
  );
}