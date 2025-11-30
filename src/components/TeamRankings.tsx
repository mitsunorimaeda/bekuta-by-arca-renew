import React, { useState } from 'react';
import { Trophy, TrendingUp, Medal, Award, Users } from 'lucide-react';
import { WeeklyRanking, PointsRanking } from '../hooks/useRankings';

interface TeamRankingsProps {
  weeklyRankings: WeeklyRanking[];
  pointsRankings: PointsRanking[];
  myUserId: string;
  compact?: boolean;
}

export function TeamRankings({ weeklyRankings, pointsRankings, myUserId, compact = false }: TeamRankingsProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'points'>('weekly');

  const getRankMedal = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' };
    if (rank === 3) return { icon: Award, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
    return null;
  };

  const renderWeeklyRankings = () => {
    const myRank = weeklyRankings.find((r) => r.user_id === myUserId);

    return (
      <div className="space-y-2">
        {weeklyRankings.slice(0, compact ? 5 : 10).map((ranking) => {
          const medal = getRankMedal(ranking.rank);
          const isMe = ranking.user_id === myUserId;

          return (
            <div
              key={ranking.user_id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                isMe
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    medal
                      ? `${medal.bg} ${medal.color}`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {medal ? <medal.icon className="w-5 h-5" /> : <span className="text-sm">{ranking.rank}</span>}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${isMe ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {ranking.user_name}
                    {isMe && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(あなた)</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ranking.weekly_records}回</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">今週</p>
                </div>
              </div>
            </div>
          );
        })}

        {myRank && myRank.rank > (compact ? 5 : 10) && (
          <>
            <div className="flex items-center justify-center py-2">
              <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700">
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  <span className="text-sm">{myRank.rank}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-700 dark:text-blue-400">
                    {myRank.user_name}
                    <span className="ml-2 text-xs">(あなた)</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{myRank.weekly_records}回</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">今週</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPointsRankings = () => {
    const myRank = pointsRankings.find((r) => r.user_id === myUserId);

    return (
      <div className="space-y-2">
        {pointsRankings.slice(0, compact ? 5 : 10).map((ranking) => {
          const medal = getRankMedal(ranking.rank);
          const isMe = ranking.user_id === myUserId;

          return (
            <div
              key={ranking.user_id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                isMe
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    medal
                      ? `${medal.bg} ${medal.color}`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {medal ? <medal.icon className="w-5 h-5" /> : <span className="text-sm">{ranking.rank}</span>}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${isMe ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {ranking.user_name}
                    {isMe && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(あなた)</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lv.{ranking.current_level}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {ranking.total_points.toLocaleString()}pt
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {myRank && myRank.rank > (compact ? 5 : 10) && (
          <>
            <div className="flex items-center justify-center py-2">
              <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700">
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  <span className="text-sm">{myRank.rank}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-700 dark:text-blue-400">
                    {myRank.user_name}
                    <span className="ml-2 text-xs">(あなた)</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lv.{myRank.current_level}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {myRank.total_points.toLocaleString()}pt
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-colors">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">チームランキング</h3>
        </div>
        {activeTab === 'weekly' ? renderWeeklyRankings() : renderPointsRankings()}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">チームランキング</h2>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>週間記録数</span>
          </button>
          <button
            onClick={() => setActiveTab('points')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'points'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>総ポイント</span>
          </button>
        </div>
      </div>

      {/* Rankings Content */}
      <div className="p-6">
        {activeTab === 'weekly' ? renderWeeklyRankings() : renderPointsRankings()}

        {(activeTab === 'weekly' ? weeklyRankings : pointsRankings).length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">ランキングデータがありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
