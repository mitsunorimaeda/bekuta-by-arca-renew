import React, { useState, useEffect, useCallback } from 'react';
import { supabase, User } from '../lib/supabase';
import { calculateACWR, getRiskColor, getRiskLabel } from '../lib/acwr';
import { Eye, Calendar } from 'lucide-react';

interface AthleteListProps {
  athletes: User[];
  onAthleteSelect: (athlete: User) => void;
}

// ★ riskLevel をちゃんと union 型にしておく
type RiskLevel = 'low' | 'good' | 'caution' | 'high';

interface AthleteWithACWR extends User {
  latestACWR?: number;
  riskLevel?: RiskLevel;
  lastTrainingDate?: string;
  recentTrainingDays?: number; // 最近の練習日数
}

export const AthleteList = React.memo(
  ({ athletes, onAthleteSelect }: AthleteListProps) => {
    const [athletesWithACWR, setAthletesWithACWR] = useState<AthleteWithACWR[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAthletesACWR = useCallback(async () => {
      try {
        const athletesData: AthleteWithACWR[] = [];

        for (const athlete of athletes) {
          // 各選手のトレーニング記録取得
          const { data: records, error } = await supabase
            .from('training_records')
            .select('*')
            .eq('user_id', athlete.id)
            .order('date', { ascending: true });

          if (error) throw error;

          const acwrData = calculateACWR(records || []);
          const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
          const lastRecord =
            records && records.length > 0 ? records[records.length - 1] : null;

          // 最近28日間の実際の練習日数（ACWRデータがある日のみ）
          const today = new Date();
          const twentyEightDaysAgo = new Date(today);
          twentyEightDaysAgo.setDate(today.getDate() - 28);

          const recentTrainingDays = acwrData.filter((data) => {
            const dataDate = new Date(data.date);
            return (
              dataDate >= twentyEightDaysAgo &&
              dataDate <= today &&
              data.acwr > 0
            );
          }).length;

          athletesData.push({
            ...athlete,
            latestACWR: latestACWR?.acwr,
            // ★ ここで RiskLevel として扱う
            riskLevel: latestACWR?.riskLevel as RiskLevel | undefined,
            lastTrainingDate: lastRecord?.date,
            recentTrainingDays,
          });
        }

        setAthletesWithACWR(athletesData);
      } catch (error) {
        console.error('Error fetching athletes ACWR data:', error);
      } finally {
        setLoading(false);
      }
    }, [athletes]);

    useEffect(() => {
      fetchAthletesACWR();
    }, [fetchAthletesACWR]);

    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-200 rounded-lg" />
            </div>
          ))}
        </div>
      );
    }

    if (athletes.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">選手がいません</h3>
          <p className="text-gray-600">
            このチームに登録されている選手がいません。
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {athletesWithACWR.map((athlete) => (
          <div
            key={athlete.id}
            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
          >
            {/* Mobile Layout */}
            <div className="block sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {athlete.name}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">{athlete.email}</p>
                </div>
                <button
                  onClick={() => onAthleteSelect(athlete)}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1 ml-2"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">詳細</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-gray-600 mb-1">ACWR</div>
                  {athlete.latestACWR ? (
                    <div
                      className="text-lg font-bold"
                      style={{
                        color: getRiskColor(athlete.riskLevel || 'good'),
                      }}
                    >
                      {athlete.latestACWR}
                    </div>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-gray-600 mb-1">リスク</div>
                  {athlete.riskLevel ? (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: getRiskColor(athlete.riskLevel) + '20',
                        color: getRiskColor(athlete.riskLevel),
                      }}
                    >
                      {getRiskLabel(athlete.riskLevel)}
                    </span>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-2">
                  <div className="text-xs text-gray-600 mb-1">練習日数</div>
                  <div className="text-lg font-bold text-blue-600">
                    {athlete.recentTrainingDays || 0}
                  </div>
                  <div className="text-xs text-gray-500">28日間</div>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{athlete.name}</h3>
                    <p className="text-sm text-gray-600">{athlete.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {/* ACWR Display */}
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">ACWR</div>
                  {athlete.latestACWR ? (
                    <div
                      className="text-xl font-bold"
                      style={{
                        color: getRiskColor(athlete.riskLevel || 'good'),
                      }}
                    >
                      {athlete.latestACWR}
                    </div>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>

                {/* Risk Level */}
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">リスク</div>
                  {athlete.riskLevel ? (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: getRiskColor(athlete.riskLevel) + '20',
                        color: getRiskColor(athlete.riskLevel),
                      }}
                    >
                      {getRiskLabel(athlete.riskLevel)}
                    </span>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>

                {/* Training Days */}
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">練習日数</div>
                  <div className="text-xl font-bold text-blue-600">
                    {athlete.recentTrainingDays || 0}
                  </div>
                  <div className="text-xs text-gray-500">28日間</div>
                </div>

                {/* Last Training */}
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">最終練習</div>
                  {athlete.lastTrainingDate ? (
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(athlete.lastTrainingDate).toLocaleDateString('ja-JP')}
                    </div>
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>

                {/* View Button */}
                <button
                  onClick={() => onAthleteSelect(athlete)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>詳細</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
);

AthleteList.displayName = 'AthleteList';