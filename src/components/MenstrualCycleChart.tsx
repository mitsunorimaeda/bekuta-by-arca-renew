import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Droplets } from 'lucide-react';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import { useBasalBodyTemperature } from '../hooks/useBasalBodyTemperature';
import { toJSTDateString } from '../lib/date';
import { formatDateJST } from '../lib/date'; // パスは実際の場所に合わせて

interface MenstrualCycleChartProps {
  userId: string;
  days?: number;
}

export function MenstrualCycleChart({ userId, days = 90 }: MenstrualCycleChartProps) {
  const { cycles, getCurrentCyclePhase } = useMenstrualCycleData(userId);
  const { temperatures } = useBasalBodyTemperature(userId);

  const currentPhase = getCurrentCyclePhase();

  const getDataForChart = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    const dataMap = new Map<string, any>();

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDateJST(d);
    
      dataMap.set(dateStr, {
        date: dateStr,
        displayDate: `${d.getMonth() + 1}/${d.getDate()}`,
        temperature: null,
        cyclePhase: null,
      });
    } 

    temperatures.forEach((temp) => {
      const entry = dataMap.get(temp.measurement_date);
      if (entry) {
        entry.temperature = Number(temp.temperature_celsius);
      }
    });

    cycles.forEach((cycle) => {
      const start = new Date(cycle.cycle_start_date);
      const end = cycle.cycle_end_date ? new Date(cycle.cycle_end_date) : today;

      

      for (let d = new Date(start); d <= end && d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateJST(d);
        const entry = dataMap.get(dateStr);

        if (entry) {
          const phase = cycles.find((c) => {
            // ここも念のため JST 基準にしたいなら同じように揃える
            const cycleStart = new Date(c.cycle_start_date + 'T00:00:00');
            const cycleEnd = c.cycle_end_date
              ? new Date(c.cycle_end_date + 'T00:00:00')
              : today;

            return d >= cycleStart && d <= cycleEnd;
          });

          if (phase) {
            entry.cyclePhase = 1;
          }
        }
      }
    });

    return Array.from(dataMap.values());
  };

  const chartData = getDataForChart();

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'menstrual':
        return 'text-red-600 dark:text-red-400';
      case 'follicular':
        return 'text-green-600 dark:text-green-400';
      case 'ovulatory':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'luteal':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Droplets className="w-6 h-6 text-pink-600 dark:text-pink-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            周期トラッキングと体温
          </h3>
        </div>
        {currentPhase && (
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-400">現在のフェーズ: </span>
            <span className={`font-semibold capitalize ${getPhaseColor(currentPhase.phase)}`}>
              {currentPhase.phase}
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="displayDate"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="temp"
            domain={[35.5, 37.5]}
            stroke="#3B82F6"
            style={{ fontSize: '12px' }}
            label={{ value: '体温（℃）', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="cycle"
            orientation="right"
            domain={[0, 1]}
            ticks={[0, 1]}
            stroke="#EC4899"
            style={{ fontSize: '12px' }}
            label={{ value: '周期', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F3F4F6',
            }}
            formatter={(value: any, name: string) => {
              if (name === 'temperature') {
                return [value ? `${value.toFixed(2)}℃` : 'データなし', '体温'];
              }
              if (name === 'cyclePhase') {
                return [value ? 'アクティブ' : '周期なし', '周期'];
              }
              return [value, name];
            }}
          />
          <Legend />
          <ReferenceLine yAxisId="temp" y={36.5} stroke="#6B7280" strokeDasharray="3 3" />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 3 }}
            connectNulls
            name="体温"
          />
          <Line
            yAxisId="cycle"
            type="stepAfter"
            dataKey="cyclePhase"
            stroke="#EC4899"
            strokeWidth={2}
            dot={false}
            name="月経周期"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-700 dark:text-gray-300">月経期</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-700 dark:text-gray-300">卵胞期</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-700 dark:text-gray-300">排卵期</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-700 dark:text-gray-300">黄体期</span>
        </div>
      </div>
    </div>
  );
}
