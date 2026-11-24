import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import StatCard from '../../components/dashboard/StatCard';
import AttackDistributionChart from '../../components/dashboard/AttackDistributionChart';
import TrafficTrendChart from '../../components/dashboard/TrafficTrendChart';
import LatestPredictionCard from '../../components/dashboard/LatestPredictionCard';
import RecentActivityTable from '../../components/dashboard/RecentActivityTable';
import ShapPreviewCard from '../../components/dashboard/ShapPreviewCard';
import {
  StatCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  CardSkeleton,
} from '../../components/common/Skeleton';
import analyticsService from '../../services/analytics.service';

export const DashboardPage = () => {
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const res = await analyticsService.getAnalytics();
      if (res && res.success && res.data) {
        setAnalytics(res.data);
      } else {
        throw new Error(res?.message || 'Invalid analytics data response');
      }
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to load dashboard analytics. Please ensure the backend is running.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch on mount and re-fetch when user revisits/refocuses the dashboard tab
  useEffect(() => {
    fetchAnalytics();

    const handleFocus = () => {
      fetchAnalytics(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAnalytics]);

  // Extract metrics safely with fallback zeros
  const summary = analytics?.summary || {
    totalPredictions: 0,
    normalCount: 0,
    maliciousCount: 0,
    normalPercentage: 0,
    maliciousPercentage: 0,
    averageConfidence: 0,
  };

  const categoryDistribution = analytics?.categoryDistribution || [];
  const timeline = analytics?.timeline || [];
  const recentActivity = analytics?.recentActivity || [];
  const latestPrediction = recentActivity.length > 0 ? recentActivity[0] : null;

  return (
    <div className="space-y-6">
      {/* Page Header with Range Selector & Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Overview of your network traffic analysis and intrusion detection activity.
          </p>
        </div>

        {/* Date Filter Dropdown & Refresh Button */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={isLoading || isRefreshing}
            className="p-2 bg-[#0F172A] border border-[#1E293B] hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Analytics"
            aria-label="Refresh analytics data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? 'animate-spin text-blue-400' : ''
              }`}
            />
          </button>

          <button
            className="flex items-center space-x-2 px-3.5 py-2 bg-[#0F172A] border border-[#1E293B] hover:border-slate-600 rounded-xl text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{timeRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
        </div>
      </div>

      {/* Error Notification Banner with Retry */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-300 shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Analytics Unavailable</p>
              <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchAnalytics(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-medium transition-colors self-end sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-6">
          {/* Row 1 Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>

          {/* Row 2 Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <ChartSkeleton className="h-[280px]" />
            </div>
            <div className="lg:col-span-5">
              <ChartSkeleton className="h-[280px]" />
            </div>
            <div className="lg:col-span-3">
              <CardSkeleton />
            </div>
          </div>

          {/* Row 3 Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <TableSkeleton rows={5} />
            </div>
            <div className="lg:col-span-4">
              <CardSkeleton />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1: 4 Key Stat Cards connected to real API */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              type="total"
              title="Total Predictions"
              value={summary.totalPredictions.toLocaleString()}
            />
            <StatCard
              type="normal"
              title="Normal Traffic"
              value={summary.normalCount.toLocaleString()}
              percentage={`${summary.normalPercentage}%`}
            />
            <StatCard
              type="malicious"
              title="Malicious Traffic"
              value={summary.maliciousCount.toLocaleString()}
              percentage={`${summary.maliciousPercentage}%`}
            />
            <StatCard
              type="confidence"
              title="Avg. Confidence"
              value={
                summary.averageConfidence > 0
                  ? summary.averageConfidence.toFixed(2)
                  : '0.00'
              }
            />
          </div>

          {/* Row 2: Charts & Latest Prediction */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Attack Distribution (Donut Chart) - 4 cols */}
            <div className="lg:col-span-4">
              <AttackDistributionChart
                data={categoryDistribution}
                totalAttacks={summary.maliciousCount}
              />
            </div>

            {/* Traffic Trend (Dual Area Line Chart) - 5 cols */}
            <div className="lg:col-span-5">
              <TrafficTrendChart data={timeline} />
            </div>

            {/* Latest Prediction Card - 3 cols */}
            <div className="lg:col-span-3">
              <LatestPredictionCard prediction={latestPrediction} />
            </div>
          </div>

          {/* Row 3: Recent Activity Table & SHAP Explanation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Recent Activity Table - 8 cols */}
            <div className="lg:col-span-8">
              <RecentActivityTable predictions={recentActivity} />
            </div>

            {/* SHAP Explanation Preview - 4 cols */}
            <div className="lg:col-span-4">
              <ShapPreviewCard />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
