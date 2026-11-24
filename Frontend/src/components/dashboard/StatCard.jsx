import React from 'react';
import { Database, ShieldCheck, AlertTriangle, Crosshair, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  subvalue,
  percentage,
  change,
  isPositive = true,
  type = 'total', // 'total' | 'normal' | 'malicious' | 'confidence'
}) => {
  const configs = {
    total: {
      icon: Database,
      iconBg: 'bg-blue-600/15 border-blue-500/30 text-blue-400 shadow-glow-blue',
      cardBorder: 'hover:border-blue-500/40',
    },
    normal: {
      icon: ShieldCheck,
      iconBg: 'bg-emerald-600/15 border-emerald-500/30 text-emerald-400 shadow-glow-green',
      cardBorder: 'hover:border-emerald-500/40',
    },
    malicious: {
      icon: AlertTriangle,
      iconBg: 'bg-rose-600/15 border-rose-500/30 text-rose-400 shadow-glow-red',
      cardBorder: 'hover:border-rose-500/40',
    },
    confidence: {
      icon: Crosshair,
      iconBg: 'bg-purple-600/15 border-purple-500/30 text-purple-400 shadow-glow-purple',
      cardBorder: 'hover:border-purple-500/40',
    },
  };

  const config = configs[type] || configs.total;
  const Icon = config.icon;

  const displayPercentage = percentage
    ? (String(percentage).startsWith('(') ? percentage : `(${percentage})`)
    : null;

  return (
    <div
      className={`
        bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5
        shadow-xl backdrop-blur-md transition-all duration-300
        hover:translate-y-[-2px] ${config.cardBorder}
      `}
    >
      <div className="flex items-center space-x-4">
        {/* Glow Icon Container */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${config.iconBg} flex-shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 truncate">
            {title}
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {value}
            </h3>
            {displayPercentage && (
              <span className={`text-sm font-semibold ${type === 'normal' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {displayPercentage}
              </span>
            )}
            {change && (
              <span
                className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-950/60'
                    : 'text-rose-400 bg-rose-950/60'
                }`}
              >
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                {change}
              </span>
            )}
          </div>
          {subvalue && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {subvalue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
