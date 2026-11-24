import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  Clock,
  Cpu,
  FileJson,
  Layers,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Search,
  Hash,
  ExternalLink,
  GitBranch,
  Crosshair,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { CardSkeleton } from '../../components/common/Skeleton';
import { FEATURE_GROUPS, FEATURES_METADATA } from '../../data/featureMetadata';
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

export const HistoryDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Features inspection tab & filter
  const [activeGroup, setActiveGroup] = useState('all');
  const [featureSearch, setFeatureSearch] = useState('');

  // Fetch single prediction details by ID
  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await predictionService.getPredictionById(id);
      if (res && res.success && res.data) {
        setPrediction(res.data);
      } else {
        throw new Error(res?.message || 'Prediction details could not be retrieved.');
      }
    } catch (err) {
      console.error('Failed to load prediction details:', err);
      const statusCode = err.response?.status;
      let msg = err.response?.data?.message || err.message || 'Failed to load prediction details.';
      if (statusCode === 404) {
        msg = 'Prediction record not found or does not belong to your account.';
      } else if (statusCode === 400) {
        msg = 'Invalid prediction ID format. Must be a 24-character hexadecimal identifier.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Determine benign vs malicious and two-stage details
  const isMalicious = prediction?.isAttack !== undefined
    ? Boolean(prediction.isAttack)
    : (prediction?.attackCategory || 'Normal').toLowerCase() !== 'normal';
  const attackCategory = prediction?.attackCategory || (isMalicious ? 'Attack' : 'Normal');
  const routingPath = prediction?.routingPath || (isMalicious ? 'stage1_and_stage2' : 'stage1_only');
  const stage1Binary = prediction?.stage1Binary || null;
  const stage2Multiclass = prediction?.stage2Multiclass || null;
  const stage2Ran = routingPath === 'stage1_and_stage2' && (isMalicious || stage2Multiclass !== null);
  const confidence = Number(prediction?.confidence || 0);
  const inputFeatures = prediction?.inputFeatures || {};

  const stage1Prob = stage1Binary?.attack_probability !== undefined
    ? Number(stage1Binary.attack_probability)
    : (isMalicious ? confidence : (1 - confidence));
  const stage1Threshold = stage1Binary?.threshold !== undefined ? Number(stage1Binary.threshold) : 0.325;

  // Sort probabilities list descending (available only if Stage 2 ran)
  const probabilitiesList = useMemo(() => {
    const rawProbs = stage2Multiclass?.probabilities || prediction?.probabilities;
    if (!stage2Ran || !rawProbs) return [];
    return Object.entries(rawProbs)
      .map(([cat, prob]) => ({
        category: cat,
        probability: Number(prob),
        percentage: Number((Number(prob) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.probability - a.probability);
  }, [stage2Ran, stage2Multiclass, prediction]);

  // Filter 42 features by group & search
  const filteredFeatures = useMemo(() => {
    return FEATURES_METADATA.filter((feat) => {
      const matchesGroup = activeGroup === 'all' || feat.group === activeGroup;
      const q = featureSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        feat.name.toLowerCase().includes(q) ||
        feat.label.toLowerCase().includes(q) ||
        feat.description.toLowerCase().includes(q);
      return matchesGroup && matchesSearch;
    });
  }, [activeGroup, featureSearch]);

  // Navigation action: Open this prediction in the Explainability page
  const handleOpenInExplain = () => {
    if (!prediction) return;
    navigate(`/explain?predictionId=${prediction._id}`, {
      state: {
        predictionId: prediction._id,
        inputFeatures: prediction.inputFeatures,
        title: `Stored #${prediction._id.slice(-6).toUpperCase()} (${prediction.attackCategory})`,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Back Button, Title, and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/history')}
          >
            Back to History
          </Button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Prediction Details
              </h1>
              {prediction && (
                <Badge variant={isMalicious ? 'malicious' : 'normal'} dot>
                  {isMalicious ? 'Malicious Threat' : 'Benign Traffic'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              ID: {id}
            </p>
          </div>
        </div>

        {/* Explainability Action Button */}
        {prediction && (
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={handleOpenInExplain}
            >
              Explain with SHAP
            </Button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-base font-semibold text-white">Unable to Load Record</h3>
          <p className="text-xs text-rose-300/80 max-w-md mx-auto">{error}</p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/history')}>
              Return to History
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={fetchDetails}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : prediction ? (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Classification */}
            <div
              className={`border rounded-2xl p-4 shadow-xl backdrop-blur-md transition-all ${
                isMalicious
                  ? 'bg-rose-950/20 border-rose-800/40 shadow-glow-red'
                  : 'bg-emerald-950/20 border-emerald-800/40 shadow-glow-green'
              }`}
            >
              <span className="text-xs text-slate-400 block mb-1">Security Verdict</span>
              <span className="text-lg font-bold text-white flex items-center gap-1.5 truncate">
                {isMalicious ? (
                  <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
                <span>{isMalicious ? attackCategory : 'Benign / Normal'}</span>
              </span>
            </div>

            {/* Stage 1 Attack Probability */}
            <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-4 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Stage 1 Attack Prob (T=32.5%)</span>
              <span className="text-lg font-bold text-white font-mono flex items-center justify-between">
                <span>{(stage1Prob * 100).toFixed(2)}%</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    isMalicious
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {isMalicious ? '≥ Threshold' : '< Threshold'}
                </span>
              </span>
            </div>

            {/* Pipeline Routing */}
            <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-4 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Routing Path</span>
              <span className="text-lg font-bold text-white font-mono truncate block">
                {routingPath === 'stage1_only' ? (
                  <span className="text-emerald-400">Stage 1 Only</span>
                ) : (
                  <span className="text-purple-400">Two-Stage</span>
                )}
              </span>
            </div>

            {/* Captured Timestamp */}
            <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-4 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Timestamp</span>
              <span className="text-xs font-semibold text-slate-200 block truncate mt-1">
                {formatDateTime(prediction.createdAt)}
              </span>
            </div>
          </div>

          {/* Two-Stage Architecture Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stage 1 Binary Detector Summary */}
            <div className="bg-[#080C16] border border-[#1E293B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <div className="flex items-center space-x-2">
                  <Crosshair className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Stage 1: Binary Intrusion Filter</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                    isMalicious
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                  }`}
                >
                  {isMalicious ? 'Attack Detected' : 'Normal Traffic'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/60">
                  <span className="text-[10px] text-slate-400 block">Attack Prob</span>
                  <span className="font-mono font-bold text-white">
                    {(stage1Prob * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/60">
                  <span className="text-[10px] text-slate-400 block">Threshold</span>
                  <span className="font-mono font-bold text-amber-400">
                    {(stage1Threshold * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/60">
                  <span className="text-[10px] text-slate-400 block">Stage 1 Verdict</span>
                  <span className="font-mono font-bold text-slate-200">
                    {stage1Binary?.prediction || (isMalicious ? 'Attack' : 'Normal')}
                  </span>
                </div>
              </div>

              {stage1Binary?.raw_log_odds !== undefined && (
                <div className="text-[11px] text-slate-400 font-mono bg-[#0F172A]/50 p-2 rounded-lg flex justify-between">
                  <span>Raw Model Output (Margin Log-Odds):</span>
                  <span className="text-white font-semibold">
                    {stage1Binary.raw_log_odds >= 0
                      ? `+${stage1Binary.raw_log_odds.toFixed(4)}`
                      : stage1Binary.raw_log_odds.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            {/* Stage 2 Multiclass Triage Summary */}
            <div className="bg-[#080C16] border border-[#1E293B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-white">Stage 2: Multiclass Attack Triage</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                    stage2Ran
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {stage2Ran ? 'Executed' : 'Bypassed'}
                </span>
              </div>

              {stage2Ran ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/60">
                    <span className="text-slate-400">Identified Attack Category:</span>
                    <span className="font-bold text-rose-300 text-sm">
                      {attackCategory}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/60">
                    <span className="text-slate-400">Multiclass Confidence:</span>
                    <span className="font-mono font-bold text-white">
                      {(confidence * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-emerald-300">
                    Stage 2 Bypassed for Benign Traffic
                  </p>
                  <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                    Stage 1 identified this flow as normal (Attack probability &lt; 32.5%). Bypassing Stage 2 prevents false positives and saves compute resources.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 10-Class Posterior Probabilities Breakdown (Only when Stage 2 Ran) */}
          {stage2Ran && probabilitiesList.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-[#1E293B]">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Stage 2: 10-Class Probability Distribution</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Sum: 100%</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {probabilitiesList.map(({ category, percentage }) => {
                    const isTop = category.toLowerCase() === attackCategory.toLowerCase();
                    const isCatNormal = category.toLowerCase() === 'normal';

                    return (
                      <div
                        key={category}
                        className={`p-3 rounded-xl border transition-colors ${
                          isTop
                            ? isCatNormal
                              ? 'bg-emerald-950/40 border-emerald-700/60 shadow-glow-green'
                              : 'bg-rose-950/40 border-rose-700/60 shadow-glow-red'
                            : 'bg-[#080C16] border-[#1E293B]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium truncate ${isTop ? 'text-white font-bold' : 'text-slate-300'}`}>
                            {category}
                          </span>
                          {isTop && (
                            <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/20 px-1 rounded">
                              Top
                            </span>
                          )}
                        </div>

                        <span className="text-sm font-bold font-mono text-white block">
                          {percentage.toFixed(2)}%
                        </span>

                        <div className="h-1 bg-[#0F172A] rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${
                              isCatNormal ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Raw Input Feature Vector (42 Features) */}
          <Card>
            <CardHeader className="pb-3 border-b border-[#1E293B]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                  <FileJson className="w-4 h-4 text-blue-400" />
                  <span>Stored Raw Input Features</span>
                  <span className="text-xs font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40">
                    42 Features
                  </span>
                </CardTitle>

                {/* Search Feature Input */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search feature..."
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                    className="w-full bg-[#080C16] border border-[#1E293B] rounded-lg pl-8 pr-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Group Tabs */}
              <div className="flex flex-wrap gap-1.5 text-[11px] pt-3">
                {FEATURE_GROUPS.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setActiveGroup(grp.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      activeGroup === grp.id
                        ? 'bg-blue-600 text-white shadow-glow-blue'
                        : 'bg-[#080C16] text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/50'
                    }`}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredFeatures.map((feat) => {
                  const val = inputFeatures[feat.name];
                  const displayVal = val !== undefined && val !== null ? String(val) : '—';

                  return (
                    <div
                      key={feat.name}
                      className="p-2.5 rounded-xl bg-[#080C16] border border-[#1E293B]/70 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="block text-[11px] font-mono text-slate-400 truncate"
                          title={`${feat.name}: ${feat.description}`}
                        >
                          {feat.name}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1 rounded uppercase ${
                            feat.type === 'str'
                              ? 'bg-purple-950/60 text-purple-400'
                              : feat.type === 'float'
                              ? 'bg-blue-950/60 text-blue-400'
                              : 'bg-emerald-950/60 text-emerald-400'
                          }`}
                        >
                          {feat.type}
                        </span>
                      </div>
                      <span className="block text-xs font-mono font-semibold text-white truncate">
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
              </div>

              {filteredFeatures.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No features match "{featureSearch}"
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default HistoryDetailsPage;
