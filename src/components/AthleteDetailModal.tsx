import React from 'react';
import { User } from '../lib/supabase';
import { useTrainingData } from '../hooks/useTrainingData';
import { ACWRChart } from './ACWRChart';
import { X, Activity, Calendar, TrendingUp } from 'lucide-react';

interface AthleteDetailModalProps {
  athlete: User;
  onClose: () => void;
}

export function AthleteDetailModal({ athlete, onClose }: AthleteDetailModalProps) {
  const { records, acwrData, loading } = useTrainingData(athlete.id);

  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
  const recentRecords = records.slice(-7); // Last 7 records

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 rounded-full p-3">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{athlete.name}</h2>
                <p className="text-blue-100">{athlete.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Current Status */}
              {latestACWR && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {latestACWR.acwr}
                    </div>
                    <div className="text-sm text-gray-600">現在のACWR</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {latestACWR.acuteLoad}
                    </div>
                    <div className="text-sm text-gray-600">急性負荷（7日間）</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {latestACWR.chronicLoad}
                    </div>
                    <div className="text-sm text-gray-600">慢性負荷（28日間平均）</div>
                  </div>
                </div>
              )}

              {/* ACWR Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ACWR推移グラフ</h3>
                <ACWRChart data={acwrData} />
              </div>

              {/* Recent Training Records */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">最近の練習記録</h3>
                {recentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {recentRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-4">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {new Date(record.date).toLocaleDateString('ja-JP')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <div className="text-gray-600">RPE</div>
                            <div className="font-semibold">{record.rpe}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">時間</div>
                            <div className="font-semibold">{record.duration_min}分</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">負荷</div>
                            <div className="font-semibold">{record.load}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">練習記録がありません</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}