import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldCheck } from 'lucide-react';

const CATEGORY_COLORS = {
  dos: '#F43F5E', // Coral red
  generic: '#A855F7', // Purple
  exploits: '#3B82F6', // Blue
  fuzzers: '#10B981', // Emerald
  reconnaissance: '#06B6D4', // Cyan
  analysis: '#EAB308', // Yellow
  backdoor: '#F97316', // Orange
  shellcode: '#8B5CF6', // Violet
  worms: '#14B8A6', // Teal
};

const FALLBACK_COLORS = [
  '#3B82F6', '#F43F5E', '#A855F7', '#10B981',
  '#06B6D4', '#EAB308', '#F97316', '#8B5CF6', '#14B8A6', '#64748B'
];

export const AttackDistributionChart = ({ data = [], totalAttacks }) => {
  // Filter out 'normal' category since Attack Distribution tracks malicious intrusions
  const attackItems = (data || []).filter(
    (item) => (item.category || item.name || '').toLowerCase() !== 'normal'
  );

  const calculatedTotal = attackItems.reduce(
    (acc, curr) => acc + (curr.count !== undefined ? curr.count : curr.value || 0),
    0
  );

  const attacksCount = totalAttacks !== undefined ? totalAttacks : calculatedTotal;

  // Format data for Recharts Pie
  const chartData = attackItems.map((item, index) => {
    const name = item.category || item.name || 'Unknown';
    const val = item.count !== undefined ? item.count : item.value || 0;
    const percentage = attacksCount > 0
      ? Number(((val / attacksCount) * 100).toFixed(1))
      : 0;
    const color = item.color || CATEGORY_COLORS[name.toLowerCase()] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

    return {
      name,
      value: val,
      percentage,
      color,
    };
  });

  const hasData = chartData.length > 0 && attacksCount > 0;

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col h-full">
      <h3 className="text-base font-semibold text-slate-100 mb-4">
        Attack Distribution
      </h3>

      <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-6 min-h-[220px]">
        {hasData ? (
          <>
            {/* Donut Chart with Centered Metric */}
            <div className="relative w-48 h-48 flex-shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-[#080C16] border border-[#1E293B] px-3 py-1.5 rounded-lg shadow-xl text-xs">
                            <span className="font-semibold text-white">{item.name}</span>: {item.percentage}% ({item.value})
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Centered label inside donut hole */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-white tracking-tight leading-none">
                  {attacksCount.toLocaleString()}
                </span>
                <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Attacks
                </span>
              </div>
            </div>

            {/* Legend Grid */}
            <div className="grid grid-cols-1 gap-y-2 w-full max-w-[200px] text-xs max-h-[200px] overflow-y-auto pr-1">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300 font-medium truncate group-hover:text-white">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-slate-400 font-semibold ml-2">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 py-6 w-full text-center sm:text-left">
            <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-[#1E293B] flex items-center justify-center">
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-500 tracking-tight leading-none">0</span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1">Attacks</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero Intrusions</span>
              </div>
              <p className="text-xs font-medium text-slate-300">No malicious threats detected</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                All analyzed traffic is classified as normal, or no prediction requests have been submitted yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttackDistributionChart;
