import React from 'react';

export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-slate-800/70 rounded ${className}`}
      {...props}
    />
  );
};

export const CardSkeleton = () => {
  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
};

export const StatCardSkeleton = () => {
  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 flex items-center space-x-4 shadow-xl">
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-28" />
      </div>
    </div>
  );
};

export const ChartSkeleton = ({ className = 'h-[300px]' }) => {
  return (
    <div className={`bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 flex flex-col justify-between shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="w-full h-full max-h-[200px] rounded-xl" />
      </div>
    </div>
  );
};

export const TableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 py-2 border-b border-[#1E293B]/40">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
