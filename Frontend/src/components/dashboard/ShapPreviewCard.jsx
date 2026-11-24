import React from 'react';
import { Info } from 'lucide-react';
import { shapPreviewData } from '../../data/mockData';

export const ShapPreviewCard = ({ data = shapPreviewData }) => {
  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1.5">
          <h3 className="text-base font-semibold text-slate-100">
            SHAP Explanation
          </h3>
          <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" title="Top local feature contributions for the predicted class" />
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Exploits / DoS
        </span>
      </div>

      {/* Contribution Rows */}
      <div className="space-y-3 my-auto">
        {data.map((item) => {
          const isPos = item.value >= 0;
          const absVal = Math.abs(item.value);
          const barWidthPercent = Math.min((absVal / 0.35) * 100, 100);

          return (
            <div key={item.feature} className="flex items-center text-xs">
              {/* Feature Name */}
              <span className="w-20 font-mono text-slate-400 text-right pr-3 truncate">
                {item.feature}
              </span>

              {/* Centered Dual-Direction Bar Container */}
              <div className="flex-1 flex items-center h-5 bg-[#080C16] rounded px-1 relative">
                {/* Center baseline line at 0 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700 z-10" />

                {/* Left side (negative) */}
                <div className="w-1/2 flex justify-end pr-0.5">
                  {!isPos && (
                    <div
                      className="h-3 rounded-l bg-blue-500 shadow-sm shadow-blue-500/40 transition-all duration-300"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  )}
                </div>

                {/* Right side (positive) */}
                <div className="w-1/2 flex justify-start pl-0.5">
                  {isPos && (
                    <div
                      className="h-3 rounded-r bg-rose-500 shadow-sm shadow-rose-500/40 transition-all duration-300"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Value Label */}
              <span className={`w-14 text-right font-mono font-medium pl-2 ${isPos ? 'text-rose-400' : 'text-blue-400'}`}>
                {isPos ? `+${item.value.toFixed(2)}` : item.value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Axis Scale */}
      <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-[#1E293B]/60 mt-3">
        <span>-0.3</span>
        <span>-0.2</span>
        <span>-0.1</span>
        <span>0.0</span>
        <span>0.1</span>
        <span>0.2</span>
        <span>0.3</span>
      </div>
    </div>
  );
};

export default ShapPreviewCard;

