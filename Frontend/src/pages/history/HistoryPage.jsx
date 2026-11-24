import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
  Database,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Skeleton';
import predictionService from '../../services/prediction.service';

const formatDateTime = (ts) => {
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
      second: '2-digit',
    });
  } catch {
    return ts;
  }
};

export const HistoryPage = () => {
  const navigate = useNavigate();

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [predictions, setPredictions] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Client-side filtering state (on currently loaded server page records)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('ALL'); // 'ALL' | 'MALICIOUS' | 'NORMAL'
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Fetch paginated history from Express backend
  const fetchHistory = useCallback(async (page, limit) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await predictionService.getHistory(page, limit);
      if (res && res.success && res.data) {
        setPredictions(res.data.predictions || []);
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        } else {
          setPaginationMeta({
            total: res.data.total || 0,
            page: res.data.page || page,
            limit: res.data.limit || limit,
            totalPages: res.data.totalPages || 1,
            hasNextPage: page < (res.data.totalPages || 1),
            hasPrevPage: page > 1,
          });
        }
      } else {
        throw new Error(res?.message || 'Invalid history response received');
      }
    } catch (err) {
      console.error('Failed to fetch prediction history:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load prediction history. Please ensure the backend is running.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when page or limit changes
  useEffect(() => {
    fetchHistory(currentPage, pageSize);
  }, [currentPage, pageSize, fetchHistory]);

  // Extract unique attack categories from current records for filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set();
    predictions.forEach((p) => {
      if (p.attackCategory) cats.add(p.attackCategory);
    });
    return Array.from(cats).sort();
  }, [predictions]);

  // Client-side filtering applied to the current page's server records
  const filteredPredictions = useMemo(() => {
    return predictions.filter((item) => {
      const isMalicious = item.isAttack !== undefined
        ? Boolean(item.isAttack)
        : (item.attackCategory || '').toLowerCase() !== 'normal';
      const outcome = isMalicious ? 'MALICIOUS' : 'NORMAL';

      const matchesOutcome = filterOutcome === 'ALL' || outcome === filterOutcome;
      const matchesCategory = filterCategory === 'ALL' || item.attackCategory === filterCategory;

      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item._id && item._id.toLowerCase().includes(q)) ||
        (item.attackCategory && item.attackCategory.toLowerCase().includes(q)) ||
        (item.routingPath && item.routingPath.toLowerCase().includes(q));

      return matchesOutcome && matchesCategory && matchesSearch;
    });
  }, [predictions, filterOutcome, filterCategory, searchTerm]);

  // Handle page navigation
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= paginationMeta.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // reset to first page
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-blue-500" />
            <span>Prediction Audit History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Historical log of all classified network connection records (newest first)
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search page by ID or attack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0F172A] border border-[#1E293B] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56 shadow-sm"
            />
          </div>

          {/* Outcome Filter */}
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 shadow-sm"
          >
            <option value="ALL">All Outcomes</option>
            <option value="MALICIOUS">Threats Only</option>
            <option value="NORMAL">Normal Only</option>
          </select>

          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchHistory(currentPage, pageSize)}
            disabled={isLoading}
            className="p-2 bg-[#0F172A] border border-[#1E293B] hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Distinction Badge: Server Pagination vs Local Filtering */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 bg-[#080C16]/60 border border-[#1E293B] rounded-xl px-4 py-2.5 gap-2">
        <div className="flex items-center space-x-2">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span>
            Server Page <strong className="text-white">{paginationMeta.page}</strong> of{' '}
            <strong className="text-white">{paginationMeta.totalPages || 1}</strong> (
            <strong className="text-slate-200">{paginationMeta.total}</strong> total stored records)
          </span>
        </div>

        {(searchTerm || filterOutcome !== 'ALL' || filterCategory !== 'ALL') && (
          <div className="flex items-center space-x-2 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
            <span>
              Filtered: {filteredPredictions.length} of {predictions.length} records on this page
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterOutcome('ALL');
                setFilterCategory('ALL');
              }}
              className="text-amber-400 hover:underline font-semibold ml-1"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-300 text-xs">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchHistory(currentPage, pageSize)}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg font-medium text-rose-200 transition-colors self-end sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} />
            </div>
          ) : predictions.length === 0 ? (
            /* Empty State: No predictions in database */
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">No Prediction History Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven't submitted any network connection metrics yet. Run an analysis in Network Prediction to log intrusions.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/predict')}
                className="mt-2"
              >
                Go to Network Prediction
              </Button>
            </div>
          ) : filteredPredictions.length === 0 ? (
            /* Empty Filter State */
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-xs font-semibold text-slate-300">No predictions match your search criteria</p>
              <p className="text-[11px] text-slate-500">
                Try adjusting your search query or outcome filter for this server page.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterOutcome('ALL');
                  setFilterCategory('ALL');
                }}
                className="text-xs text-blue-400 hover:underline pt-1 block mx-auto"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-400 font-medium bg-[#0B0F19]/50">
                    <th className="py-3 px-3">Record ID</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Stage 1 Verdict</th>
                    <th className="py-3 px-3">Routing Path</th>
                    <th className="py-3 px-3">Attack Prob</th>
                    <th className="py-3 px-3">Stage 2 Category</th>
                    <th className="py-3 px-3 min-w-[120px]">Confidence</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60">
                  {filteredPredictions.map((item) => {
                    const isMalicious = item.isAttack !== undefined
                      ? Boolean(item.isAttack)
                      : (item.attackCategory || '').toLowerCase() !== 'normal';
                    const attackCategory = item.attackCategory || (isMalicious ? 'Attack' : 'Normal');
                    const routingPath = item.routingPath || (isMalicious ? 'stage1_and_stage2' : 'stage1_only');
                    const stage1Binary = item.stage1Binary || null;
                    const stage1Prob = stage1Binary?.attack_probability !== undefined
                      ? Number(stage1Binary.attack_probability)
                      : (isMalicious ? Number(item.confidence || 1) : (1 - Number(item.confidence || 0.999)));
                    const confidenceVal = Number(item.confidence || 0);
                    const confPercent = Math.min(Math.round(confidenceVal * 100), 100);
                    const formattedId = `#${item._id.slice(-6).toUpperCase()}`;

                    return (
                      <tr
                        key={item._id}
                        className="hover:bg-[#080C16]/50 transition-colors duration-150 cursor-pointer group"
                        onClick={() => navigate(`/history/${item._id}`)}
                      >
                        {/* Record ID */}
                        <td className="py-3 px-3 font-mono font-medium text-blue-400" title={item._id}>
                          {formattedId}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                          {formatDateTime(item.createdAt)}
                        </td>

                        {/* Stage 1 Verdict Badge */}
                        <td className="py-3 px-3">
                          <Badge variant={isMalicious ? 'malicious' : 'normal'} size="sm" dot>
                            {isMalicious ? 'Attack' : 'Normal'}
                          </Badge>
                        </td>

                        {/* Routing Path */}
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              routingPath === 'stage1_only'
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                                : 'bg-purple-950/40 text-purple-300 border-purple-800/40'
                            }`}
                          >
                            {routingPath === 'stage1_only' ? 'Stage 1 Only' : 'Two-Stage'}
                          </span>
                        </td>

                        {/* Stage 1 Attack Probability */}
                        <td className="py-3 px-3 font-mono font-medium text-slate-200">
                          <span
                            className={
                              stage1Prob >= 0.325 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'
                            }
                          >
                            {(stage1Prob * 100).toFixed(1)}%
                          </span>
                        </td>

                        {/* Stage 2 Attack Category */}
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          {isMalicious ? (
                            <span className="text-rose-300 flex items-center space-x-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 inline" />
                              <span>{attackCategory}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px] flex items-center space-x-1">
                              <span>Bypassed</span>
                            </span>
                          )}
                        </td>

                        {/* Confidence Progress Bar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-slate-200 w-11 text-right">
                              {(confidenceVal * 100).toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-[#080C16] rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  isMalicious
                                    ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                }`}
                                style={{ width: `${confPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div
                            className="flex items-center justify-end space-x-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Explain Shortcut */}
                            <button
                              onClick={() => navigate(`/explain?predictionId=${item._id}`)}
                              className="px-2 py-1 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                              title="Explain prediction using SHAP"
                            >
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span className="hidden md:inline">Explain</span>
                            </button>

                            {/* View Details */}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              onClick={() => navigate(`/history/${item._id}`)}
                            >
                              Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-Side Pagination Bar */}
          <div className="p-4 border-t border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            {/* Rows Per Page Selector */}
            <div className="flex items-center space-x-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="bg-[#080C16] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="hidden sm:inline">
                &bull; Total records: <strong className="text-slate-200">{paginationMeta.total}</strong>
              </span>
            </div>

            {/* Prev / Page / Next Buttons */}
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!paginationMeta.hasPrevPage || isLoading}
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </button>

              <span className="px-2 font-medium text-slate-300">
                Page {paginationMeta.page} of {paginationMeta.totalPages || 1}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!paginationMeta.hasNextPage || isLoading}
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryPage;
