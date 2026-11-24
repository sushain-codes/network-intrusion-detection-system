import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '../common/Badge';

const formatActivityTime = (ts) => {
  if (!ts) return 'Unknown';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
};

export const RecentActivityTable = ({ predictions = [] }) => {
  const hasData = predictions && predictions.length > 0;

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-100">
          Recent Prediction Activity
        </h3>
        <Link
          to="/history"
          className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center transition-colors group"
        >
          <span>View History</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1E293B] text-slate-400 font-medium pb-2">
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Result</th>
              <th className="py-2.5 px-3">Attack Category</th>
              <th className="py-2.5 px-3 min-w-[140px]">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/60">
            {hasData ? (
              predictions.map((item, index) => {
                const isMalicious = item.isAttack !== undefined
                  ? Boolean(item.isAttack)
                  : (item.attackCategory || item.attack_category || 'Normal').toLowerCase() !== 'normal';
                const attackCategory = item.attackCategory || item.attack_category || (isMalicious ? 'Attack' : 'Normal');
                const confidence = typeof item.confidence === 'number'
                  ? item.confidence
                  : parseFloat(item.confidence) || 0;
                const confPercent = Math.min(Math.round(confidence * 100), 100);
                const timeStr = formatActivityTime(item.createdAt || item.time);
                const itemId = item._id || item.id || `pred-${index}`;

                return (
                  <tr
                    key={itemId}
                    className="hover:bg-[#080C16]/50 transition-colors duration-150"
                  >
                    {/* Time + Icon */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2.5">
                        {isMalicious ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                        <span className="text-slate-300 font-medium whitespace-nowrap">{timeStr}</span>
                      </div>
                    </td>

                    {/* Result Badge */}
                    <td className="py-3 px-3">
                      <Badge variant={isMalicious ? 'malicious' : 'normal'} size="sm">
                        {isMalicious ? 'Threat' : 'Normal'}
                      </Badge>
                    </td>

                    {/* Attack Category */}
                    <td className="py-3 px-3 text-slate-200 font-medium">
                      {isMalicious ? (
                        <span className="text-rose-300 font-semibold">{attackCategory}</span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Bypassed</span>
                      )}
                    </td>

                    {/* Confidence with Progress Bar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-slate-200 w-11 text-xs">
                          {(confidence * 100).toFixed(1)}%
                        </span>
                        <div className="flex-1 h-1.5 bg-[#080C16] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isMalicious
                                ? 'bg-gradient-to-r from-rose-500 to-rose-400 shadow-sm shadow-rose-500/50'
                                : 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm shadow-emerald-500/50'
                            }`}
                            style={{ width: `${confPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-1">
                      <Clock className="w-5 h-5 text-slate-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">No Recent Activity</p>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Predictions you submit will automatically populate this log in real time.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentActivityTable;
