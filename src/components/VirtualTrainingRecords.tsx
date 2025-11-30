import React from 'react';
import { TrainingRecord } from '../lib/supabase';
import { VirtualScrollList } from './VirtualScrollList';
import { Calendar, Clock, Zap } from 'lucide-react';

interface VirtualTrainingRecordsProps {
  records: TrainingRecord[];
  loading?: boolean;
}

export function VirtualTrainingRecords({ records, loading }: VirtualTrainingRecordsProps) {
  const renderRecord = (record: TrainingRecord, index: number) => (
    <div className="flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <div className="flex-1 grid grid-cols-4 gap-4">
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span className="font-medium text-gray-900">
            {new Date(record.date).toLocaleDateString('ja-JP')}
          </span>
        </div>
        
        <div className="flex items-center justify-center">
          <Zap className="w-4 h-4 mr-2 text-gray-400" />
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            record.rpe >= 8 ? 'bg-red-100 text-red-800' :
            record.rpe >= 6 ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            RPE {record.rpe}
          </span>
        </div>
        
        <div className="flex items-center justify-center">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">{record.duration_min}分</span>
        </div>
        
        <div className="flex items-center justify-center">
          <span className="font-semibold text-gray-900">負荷: {record.load}</span>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 ml-4">
        #{index + 1}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">練習記録一覧（仮想スクロール）</h3>
        <p className="text-sm text-gray-600">
          大量のデータを効率的に表示します。キーボードでナビゲーション可能です。
        </p>
      </div>
      
      <VirtualScrollList
        items={records}
        itemHeight={80} // 各アイテムの高さ（px）
        containerHeight={400} // コンテナの高さ（px）
        renderItem={renderRecord}
        loading={loading}
        emptyMessage="練習記録がありません"
        overscan={3} // 表示領域外に描画する要素数
      />
    </div>
  );
}