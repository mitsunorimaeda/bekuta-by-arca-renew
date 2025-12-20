import React from 'react';

type WeeklyAverage = {
  rpe: number;
  duration: number;
  load: number;
};

export function DerivedStatsBar(props: {
  daysWithData: number;
  consecutiveDays: number;
  weeklyAverage: WeeklyAverage | null;
}) {
  const { daysWithData, consecutiveDays, weeklyAverage } = props;

  return (
    <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
      記録日数: <span className="font-semibold">{daysWithData}</span> ／
      連続: <span className="font-semibold">{consecutiveDays}</span>
      {weeklyAverage && (
        <>
          {' '}／ 7日平均RPE:{' '}
          <span className="font-semibold">{weeklyAverage.rpe.toFixed(1)}</span>
          {' '}平均時間:{' '}
          <span className="font-semibold">{weeklyAverage.duration.toFixed(0)}分</span>
        </>
      )}
    </div>
  );
}