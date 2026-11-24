import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const formatDisplayDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
  }
  return dateStr;
};

export const TrafficTrendChart = ({ data = [] }) => {
  const chartData = (data || []).map((item) => ({
    date: formatDisplayDate(item.date),
    rawDate: item.date,
    normal: item.normal ?? 0,
    malicious: item.malicious ?? 0,
    total: item.total ?? ((item.normal ?? 0) + (item.malicious ?? 0)),
  }));

  const hasData = chartData.length > 0;

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col h-full">
      {/* Header & Legend */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-100">
          Traffic Trend
        </h3>
        <div className="flex items-center space-x-4 text-xs font-medium">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-300">Normal</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-300">Malicious</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      {hasData ? (
        <div className="flex-1 w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="maliciousGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const total = (payload[0]?.value || 0) + (payload[1]?.value || 0);
                    return (
                      <div className="bg-[#080C16] border border-[#1E293B] p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                        <p className="font-semibold text-slate-300 border-b border-[#1E293B] pb-1 mb-1">
                          {label} (Total: {total})
                        </p>
                        <p className="text-blue-400 font-medium">
                          Normal: <span className="text-white font-bold">{payload[0]?.value ?? 0}</span>
                        </p>
                        <p className="text-rose-400 font-medium">
                          Malicious: <span className="text-white font-bold">{payload[1]?.value ?? 0}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="normal"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#normalGrad)"
                dot={{ fill: '#3B82F6', r: 3.5, strokeWidth: 1, stroke: '#FFFFFF' }}
                activeDot={{ r: 5, fill: '#60A5FA' }}
              />
              <Area
                type="monotone"
                dataKey="malicious"
                stroke="#F43F5E"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#maliciousGrad)"
                dot={{ fill: '#F43F5E', r: 3.5, strokeWidth: 1, stroke: '#FFFFFF' }}
                activeDot={{ r: 5, fill: '#FB7185' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 w-full h-[220px] flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-300">No Traffic Trend Data</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
            Daily traffic patterns will appear here as predictions are logged over time.
          </p>
        </div>
      )}
    </div>
  );
};

export default TrafficTrendChart;
