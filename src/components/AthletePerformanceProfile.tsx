import React, { useState } from 'react';
import {
  RadarChart,
  Radar,
  PolarAngleAxis,
  PolarRadiusAxis,
  PolarGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from 'recharts';
import { User, ChevronDown, ChevronUp, Trophy, TrendingUp, Activity, Zap, Target } from 'lucide-react';
import {
  useAthleteProfile,
  CategoryPercentile,
  CategoryTrend,
  TestTrend,
} from '../hooks/useAthleteProfile';

// --- Category icon map ---
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  jump: <Zap className="w-5 h-5" />,
  sprint: <Activity className="w-5 h-5" />,
  strength: <Trophy className="w-5 h-5" />,
  endurance: <TrendingUp className="w-5 h-5" />,
  agility: <Target className="w-5 h-5" />,
};

// --- Grade helpers ---
function getGrade(percentile: number): { grade: string; label: string; cls: string } {
  if (percentile >= 90) return { grade: 'S', label: 'トップ', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };
  if (percentile >= 75) return { grade: 'A', label: '上位', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
  if (percentile >= 60) return { grade: 'B', label: '平均以上', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  if (percentile >= 40) return { grade: 'C', label: '平均', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
  if (percentile >= 20) return { grade: 'D', label: '平均以下', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
  return { grade: 'E', label: '要改善', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
}

// --- Grade badge ---
function GradeBadge({ percentile, size = 'md' }: { percentile: number; size?: 'sm' | 'md' }) {
  const { grade, cls } = getGrade(percentile);
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-bold ${cls} ${sizeClass}`}>
      {grade}
    </span>
  );
}

// --- Format value ---
function formatValue(value: number, unit: string): string {
  if (unit === 'RSI' || unit === '秒') return value.toFixed(2);
  if (unit === 'ml/kg/min') return value.toFixed(1);
  return value.toFixed(1);
}

// --- Overall score circle ---
function OverallScoreCircle({ score }: { score: number | null }) {
  if (score === null) return null;

  const { grade, cls } = getGrade(score);
  const color =
    score >= 90 ? 'text-purple-500'
      : score >= 75 ? 'text-emerald-500'
      : score >= 60 ? 'text-blue-500'
      : score >= 40 ? 'text-yellow-500'
      : score >= 20 ? 'text-orange-500'
      : 'text-red-500';

  const bgColor =
    score >= 90 ? 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
      : score >= 75 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20'
      : score >= 60 ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
      : score >= 40 ? 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20'
      : score >= 20 ? 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20'
      : 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20';

  return (
    <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${bgColor}`}>
      <span className={`text-3xl font-bold ${color}`}>{grade}</span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">総合</span>
    </div>
  );
}

// --- Sparkline chart ---
function SparklineChart({ testTrend }: { testTrend: TestTrend }) {
  if (testTrend.data.length < 2) return null;

  return (
    <div className="h-[50px] w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={testTrend.data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            contentStyle={{
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 8px',
            }}
            formatter={(v: number) => [`${formatValue(v, testTrend.unit)} ${testTrend.unit}`, testTrend.testDisplayName]}
            labelFormatter={(label) => new Date(label).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366F1"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#6366F1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Category card ---
function CategoryCard({
  cat,
  trend,
}: {
  cat: CategoryPercentile;
  trend?: CategoryTrend;
}) {
  const [expanded, setExpanded] = useState(false);
  const icon = CATEGORY_ICONS[cat.categoryName] ?? <Activity className="w-5 h-5" />;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-indigo-500 dark:text-indigo-400">{icon}</div>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {cat.categoryDisplayName}
          </span>
          {cat.hasSufficientData ? (
            <GradeBadge percentile={cat.percentile} />
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
              データ不足
            </span>
          )}
        </div>
        <div className="text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
          {/* Test rows */}
          {cat.tests.map((test) => {
            const testTrend = trend?.tests.find((t) => t.testTypeId === test.testTypeId);

            return (
              <div key={test.testTypeId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {test.testDisplayName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatValue(test.athleteValue, test.unit)}
                      <span className="text-xs text-gray-400 ml-0.5">{test.unit}</span>
                    </span>
                    {test.hasSufficientData ? (
                      <GradeBadge percentile={test.percentile} size="sm" />
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                        n={test.totalAthletes}
                      </span>
                    )}
                  </div>
                </div>
                {testTrend && <SparklineChart testTrend={testTrend} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Main component ---
interface AthletePerformanceProfileProps {
  userId: string;
  onClose?: () => void;
}

export default function AthletePerformanceProfile({ userId, onClose }: AthletePerformanceProfileProps) {
  const {
    userInfo,
    categoryPercentiles,
    categoryTrends,
    radarData,
    overallScore,
    loading,
    error,
  } = useAthleteProfile(userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!userInfo) return null;

  const hasData = categoryPercentiles.length > 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* --- Header --- */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{userInfo.name}</h2>
                <p className="text-white/80 text-sm">{userInfo.teamName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/70 mt-2">
              {userInfo.age !== null && <span>{userInfo.age}歳</span>}
              {userInfo.heightCm !== null && <span>{userInfo.heightCm}cm</span>}
              {userInfo.gender && (
                <span>
                  {userInfo.gender === 'male' ? '男性' : userInfo.gender === 'female' ? '女性' : ''}
                </span>
              )}
            </div>
          </div>
          <OverallScoreCircle score={overallScore} />
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/60 hover:text-white text-sm"
          >
            閉じる
          </button>
        )}
      </div>

      {/* --- Radar Chart --- */}
      {hasData && radarData.length >= 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 text-center">
            能力バランス
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 font-normal">
              全選手比較
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                tickCount={5}
              />
              <Radar
                name="パーセンタイル"
                dataKey="percentile"
                stroke="#6366F1"
                fill="#6366F1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* --- Category Cards --- */}
      {hasData ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white px-1">
            カテゴリ別詳細
          </h3>
          {categoryPercentiles.map((cat) => {
            const trend = categoryTrends.find((t) => t.categoryName === cat.categoryName);
            return <CategoryCard key={cat.categoryName} cat={cat} trend={trend} />;
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <Trophy className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            パフォーマンスデータがまだありません
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            測定を記録すると、ここにプロフィールが表示されます
          </p>
        </div>
      )}
    </div>
  );
}
