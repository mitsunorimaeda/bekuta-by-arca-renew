import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts';
import { WeeklyTrend, MonthlyTrend } from '../lib/trendAnalysis';

interface TrendChartProps {
  data: WeeklyTrend[] | MonthlyTrend[];
  type: 'weekly' | 'monthly';
  period?: string;
}

export function TrendChart({ data, type, period = 'all' }: TrendChartProps) {
  // データをフィルタリング
  const filteredData = React.useMemo(() => {
    if (period === 'all') return data;
    
    const limit = period === 'last4' ? 4 : period === 'last8' ? 8 : data.length;
    return data.slice(-limit);
  }, [data, period]);

  const formatXAxisLabel = (value: any, index: number) => {
    if (type === 'weekly') {
      const week = filteredData[index] as WeeklyTrend;
      if (week && week.startDate && week.endDate) {
        const startDate = new Date(week.startDate);
        const endDate = new Date(week.endDate);
        return `${startDate.getMonth() + 1}/${startDate.getDate()}~${endDate.getMonth() + 1}/${endDate.getDate()}`;
      }
      return `第${week?.weekNumber || value}週`;
    } else {
      const month = filteredData[index] as MonthlyTrend;
      return `${month?.monthName || value}`;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">
            {type === 'weekly' ? 
              (data.startDate && data.endDate ? 
                `${new Date(data.startDate).getMonth() + 1}/${new Date(data.startDate).getDate()}~${new Date(data.endDate).getMonth() + 1}/${new Date(data.endDate).getDate()}` : 
                `第${data.weekNumber}週`
              ) : 
              `${data.year}年${data.monthName}`
            }
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between">
              <span>平均ACWR:</span>
              <span className="font-semibold text-purple-600">{data.averageACWR}</span>
            </p>
            <p className="flex justify-between">
              <span>最大ACWR:</span>
              <span className="font-semibold text-red-600">{data.maxACWR}</span>
            </p>
            <p className="flex justify-between">
              <span>最小ACWR:</span>
              <span className="font-semibold text-blue-600">{data.minACWR}</span>
            </p>
            <p className="flex justify-between">
              <span>練習日数:</span>
              <span className="font-semibold">{data.trainingDays}日</span>
            </p>
            <p className="flex justify-between">
              <span>リスク日数:</span>
              <span className={`font-semibold ${data.riskDays > (type === 'weekly' ? 2 : 6) ? 'text-red-600' : 'text-green-600'}`}>
                {data.riskDays}日
              </span>
            </p>
            <p className="flex justify-between">
              <span>総負荷:</span>
              <span className="font-semibold">{data.totalLoad}</span>
            </p>
            <p className="flex justify-between">
              <span>トレンド:</span>
              <span className={`font-semibold ${
                data.trend === 'increasing' ? 'text-red-600' : 
                data.trend === 'decreasing' ? 'text-blue-600' : 'text-green-600'
              }`}>
                {data.trend === 'increasing' ? '上昇' : 
                 data.trend === 'decreasing' ? '下降' : '安定'} 
                ({data.trendPercentage}%)
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">データがありません</p>
          <p className="text-sm">練習記録が蓄積されるとトレンドグラフが表示されます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ACWR Trend Line Chart */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">ACWR推移</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="weekNumber"
                tickFormatter={formatXAxisLabel}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                domain={[0, 'dataMax + 0.5']}
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for risk zones */}
              <ReferenceLine y={1.5} stroke="#EF4444" strokeDasharray="5 5" label="高リスク" />
              <ReferenceLine y={1.3} stroke="#F59E0B" strokeDasharray="5 5" label="注意" />
              <ReferenceLine y={1.0} stroke="#10B981" strokeDasharray="5 5" label="良好" />
              <ReferenceLine y={0.8} stroke="#3B82F6" strokeDasharray="5 5" label="低負荷" />
              
              <Line
                type="monotone"
                dataKey="averageACWR"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: "#8B5CF6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "#8B5CF6", strokeWidth: 2, fill: "white" }}
                name="平均ACWR"
              />
              <Line
                type="monotone"
                dataKey="maxACWR"
                stroke="#EF4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#EF4444", strokeWidth: 2, r: 3 }}
                name="最大ACWR"
              />
              <Line
                type="monotone"
                dataKey="minACWR"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#3B82F6", strokeWidth: 2, r: 3 }}
                name="最小ACWR"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Training Days and Risk Days Bar Chart */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">練習日数とリスク日数</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="weekNumber"
                tickFormatter={formatXAxisLabel}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
              />
              <Tooltip 
                formatter={(value, name) => [
                  `${value}日`, 
                  name
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return type === 'weekly' ? 
                      (data.startDate && data.endDate ? 
                        `${new Date(data.startDate).getMonth() + 1}/${new Date(data.startDate).getDate()}~${new Date(data.endDate).getMonth() + 1}/${new Date(data.endDate).getDate()}` : 
                        `第${data.weekNumber}週`
                      ) : 
                      `${data.year}年${data.monthName}`;
                  }
                  return label;
                }}
              />
              
              <Bar 
                dataKey="trainingDays" 
                fill="#10B981" 
                name="練習日数"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="riskDays" 
                fill="#EF4444" 
                name="リスク日数"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend - Centered at bottom */}
      <div className="flex justify-center">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-1 bg-purple-500 mr-2"></div>
            <span>平均ACWR</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-1 bg-red-500 mr-2" style={{ borderTop: '2px dashed #EF4444' }}></div>
            <span>最大ACWR</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-1 bg-blue-500 mr-2" style={{ borderTop: '2px dashed #3B82F6' }}></div>
            <span>最小ACWR</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-3 bg-green-500 mr-2"></div>
            <span>練習日数</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-3 bg-red-500 mr-2"></div>
            <span>リスク日数</span>
          </div>
        </div>
      </div>
    </div>
  );
}