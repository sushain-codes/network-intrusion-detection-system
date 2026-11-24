import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ size = 'md', className = '', message }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="relative">
        <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-blue-500`} />
        <div className="absolute inset-0 blur-sm bg-blue-500/20 rounded-full animate-pulse" />
      </div>
      {message && (
        <p className="mt-3 text-xs text-slate-400 font-medium tracking-wide">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;

