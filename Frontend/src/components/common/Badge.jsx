import React from 'react';

const badgeVariants = {
  malicious: 'bg-rose-950/70 text-rose-300 border-rose-800/60 shadow-sm shadow-rose-900/20',
  normal: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60 shadow-sm shadow-emerald-900/20',
  info: 'bg-blue-950/70 text-blue-300 border-blue-800/60 shadow-sm shadow-blue-900/20',
  warning: 'bg-amber-950/70 text-amber-300 border-amber-800/60 shadow-sm shadow-amber-900/20',
  purple: 'bg-purple-950/70 text-purple-300 border-purple-800/60 shadow-sm shadow-purple-900/20',
  slate: 'bg-slate-800/70 text-slate-300 border-slate-700/60',
};

export const Badge = ({
  children,
  variant = 'info',
  size = 'md',
  className = '',
  dot = false,
  ...props
}) => {
  const selectedVariant = badgeVariants[variant] || badgeVariants.info;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${selectedVariant}
        ${sizeClass}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            variant === 'malicious' ? 'bg-rose-400 animate-pulse' :
            variant === 'normal' ? 'bg-emerald-400' :
            variant === 'warning' ? 'bg-amber-400' :
            variant === 'purple' ? 'bg-purple-400' :
            'bg-blue-400'
          }`}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;

