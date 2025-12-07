import React, { useState } from 'react';
import { Target, Plus, CheckCircle, Clock, TrendingUp, Trash2, X, Award, Calendar, TrendingDown, AlertTriangle } from 'lucide-react';
import { Goal } from '../hooks/useGoals';

interface GoalManagementProps {
  goals: Goal[];
  onCreateGoal: (goalData: any) => Promise<any>;
  onUpdateGoal: (goalId: string, updates: Partial<Goal>) => Promise<any>;
  onCompleteGoal: (goalId: string) => Promise<any>;
  onDeleteGoal: (goalId: string) => Promise<any>;
  getGoalProgress: (goal: Goal) => number;
  getDaysUntilDeadline: (goal: Goal) => number | null;
  isGoalOverdue: (goal: Goal) => boolean;
}

export function GoalManagement({
  goals,
  onCreateGoal,
  onUpdateGoal,
  onCompleteGoal,
  onDeleteGoal,
  getGoalProgress,
  getDaysUntilDeadline,
  isGoalOverdue,
}: GoalManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    goal_type: 'custom' as Goal['goal_type'],
    title: '',
    description: '',
    target_value: '',
    unit: '',
    deadline: '',
  });

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await onCreateGoal({
      ...formData,
      target_value: formData.target_value ? parseFloat(formData.target_value) : null,
      metadata: {},
    });

    if (!result.error) {
      setFormData({
        goal_type: 'custom',
        title: '',
        description: '',
        target_value: '',
        unit: '',
        deadline: '',
      });
      setShowCreateForm(false);
    }
  };

  const getGoalTypeLabel = (type: Goal['goal_type']) => {
    switch (type) {
      case 'performance':
        return 'パフォーマンス';
      case 'weight':
        return '体重';
      case 'streak':
        return 'ストリーク';
      case 'habit':
        return '習慣';
      default:
        return 'カスタム';
    }
  };

  const getGoalTypeColor = (type: Goal['goal_type']) => {
    switch (type) {
      case 'performance':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'weight':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'streak':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
      case 'habit':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const totalGoals = goals.length;
  const achievementRate = totalGoals > 0 ? Math.round((completedGoals.length / totalGoals) * 100) : 0;
  const averageProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, goal) => sum + getGoalProgress(goal), 0) / activeGoals.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">目標管理</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            達成: {completedGoals.length} / 進行中: {activeGoals.length}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>新しい目標</span>
        </button>
      </div>

      {/* Statistics Summary */}
      {totalGoals > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">総目標数</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{totalGoals}</p>
              </div>
              <Target className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">達成率</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">{achievementRate}%</p>
              </div>
              <Award className="w-10 h-10 text-green-600 dark:text-green-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">平均進捗</p>
                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">{averageProgress}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-yellow-600 dark:text-yellow-400 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Create Goal Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">新しい目標を作成</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                目標の種類
              </label>
              <select
                value={formData.goal_type}
                onChange={(e) => setFormData({ ...formData, goal_type: e.target.value as Goal['goal_type'] })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
              >
                <option value="custom">カスタム</option>
                <option value="performance">パフォーマンス</option>
                <option value="weight">体重</option>
                <option value="streak">ストリーク</option>
                <option value="habit">習慣</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                目標タイトル*
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例: 垂直跳び50cm達成"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                説明
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="目標の詳細を入力..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  目標値
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  placeholder="50"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  単位
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="cm"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                期限
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                作成
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">進行中の目標</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal) => {
              const progress = getGoalProgress(goal);
              const daysLeft = getDaysUntilDeadline(goal);
              const overdue = isGoalOverdue(goal);

              return (
                <div
                  key={goal.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getGoalTypeColor(goal.goal_type)}`}>
                          {getGoalTypeLabel(goal.goal_type)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{goal.title}</h4>
                      {goal.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{goal.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {goal.target_value && (
                    <>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">進捗</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {goal.current_value} / {goal.target_value} {goal.unit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress >= 100
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : progress >= 75
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                : progress >= 50
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                                : 'bg-gradient-to-r from-red-500 to-pink-500'
                            }`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(progress)}% 完了
                          </p>
                          <div className="flex items-center space-x-1">
                            {progress >= 75 ? (
                              <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                            ) : progress >= 25 ? (
                              <TrendingUp className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              残り {Number(goal.target_value) - Number(goal.current_value)} {goal.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    {goal.deadline && (
                      <div className={`flex items-center space-x-1 text-sm ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        <Clock className="w-4 h-4" />
                        <span>
                          {overdue
                            ? '期限切れ'
                            : daysLeft !== null
                            ? `あと${daysLeft}日`
                            : '期限なし'}
                        </span>
                      </div>
                    )}
                    {progress >= 100 && (
                      <button
                        onClick={() => onCompleteGoal(goal.id)}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>達成！</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">達成した目標</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.slice(0, 4).map((goal) => (
              <div
                key={goal.id}
                className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{goal.title}</h4>
                    {goal.target_value && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {goal.target_value} {goal.unit} 達成
                      </p>
                    )}
                    {goal.completed_at && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(goal.completed_at).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeGoals.length === 0 && completedGoals.length === 0 && !showCreateForm && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">目標を設定しましょう</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            目標を設定して、モチベーションを保ちながら成長しましょう
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>最初の目標を作成</span>
          </button>
        </div>
      )}
    </div>
  );
}
