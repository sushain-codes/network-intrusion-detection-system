import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Layers,
  BarChart3,
  Info,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
  FileText,
  Database,
  ArrowRight,
  HelpCircle,
  Zap,
  ShieldCheck,
  Crosshair,
  GitBranch,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { samplePresets } from '../../data/mockData';
import { validateFeaturePayload } from '../../data/featureMetadata';
import explainService from '../../services/explain.service';
import predictionService from '../../services/prediction.service';

/**
 * Categorize transformed feature names into human-readable network categories
 */
const getFeatureCategory = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('proto')) return 'Protocol';
  if (lower.includes('ttl')) return 'TTL';
  if (lower.includes('state')) return 'Connection State';
  if (lower.includes('bytes')) return 'Byte Volume';
  if (lower.includes('load')) return 'Throughput';
  if (lower.includes('rate')) return 'Packet Rate';
  if (lower.includes('service')) return 'Service';
  if (lower.includes('pkt') || lower.includes('spkts') || lower.includes('dpkts')) return 'Packet Count';
  if (lower.includes('mean')) return 'Packet Size';
  if (lower.includes('dur')) return 'Duration';
  if (lower.includes('ct_') || lower.includes('count')) return 'Flow Count';
  if (lower.includes('win') || lower.includes('tcp')) return 'TCP Window/Seq';
  if (lower.includes('jit') || lower.includes('rtt') || lower.includes('synack') || lower.includes('ackdat')) return 'Timing / RTT';
  if (lower.includes('ftp') || lower.includes('http')) return 'App Flow';
  return 'Network Feature';
};

export const ExplainabilityPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Tab State: 'global' | 'local'
  const [activeTab, setActiveTab] = useState('global');

  // ---------------------------------------------------------------------------
  // Global Explanations State
  // ---------------------------------------------------------------------------
  const [globalModelType, setGlobalModelType] = useState('binary'); // 'binary' | 'multiclass'
  const [globalData, setGlobalData] = useState(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  const fetchGlobalExplanations = useCallback(async (modelType = globalModelType) => {
    setIsGlobalLoading(true);
    setGlobalError(null);
    try {
      const res = modelType === 'binary'
        ? await explainService.getBinaryGlobalExplanations()
        : await explainService.getGlobalExplanations();
      if (res && res.success && res.data) {
        setGlobalData(res.data);
      } else {
        throw new Error(res?.message || 'Invalid global explanations response');
      }
    } catch (err) {
      console.error('Failed to fetch global SHAP explanations:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.details ||
        err.message ||
        'Failed to load global SHAP importance. Verify the ML service is online.';
      setGlobalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsGlobalLoading(false);
    }
  }, [globalModelType]);

  useEffect(() => {
    fetchGlobalExplanations(globalModelType);
  }, [globalModelType, fetchGlobalExplanations]);

  const handleGlobalModelTypeChange = (type) => {
    setGlobalModelType(type);
    fetchGlobalExplanations(type);
  };

  // ---------------------------------------------------------------------------
  // Local Explanations State
  // ---------------------------------------------------------------------------
  const [inputSource, setInputSource] = useState('preset'); // 'preset' | 'history'
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [historyPredictions, setHistoryPredictions] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [activeFeatures, setActiveFeatures] = useState({ ...samplePresets[0].data });
  const [currentRecordInfo, setCurrentRecordInfo] = useState({
    title: samplePresets[0].name,
    id: null,
  });

  const [localExplanation, setLocalExplanation] = useState(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [localViewMode, setLocalViewMode] = useState('diverging'); // 'diverging' | 'positive' | 'negative'

  // Fetch recent user predictions for the history selector
  const fetchUserHistory = useCallback(async () => {
    try {
      const res = await predictionService.getHistory(1, 10);
      if (res && res.success && res.data?.predictions) {
        setHistoryPredictions(res.data.predictions);
      }
    } catch (err) {
      console.warn('Could not fetch prediction history for explanation picker:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchUserHistory();
  }, [fetchUserHistory]);

  // Handle generating local SHAP explanation
  const handleGenerateLocalExplanation = useCallback(async (featuresToExplain, recordMeta = null) => {
    const payload = featuresToExplain || activeFeatures;
    const { isValid, errors, payload: sanitized } = validateFeaturePayload(payload);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      setLocalError(`Invalid feature input: ${firstErr}`);
      return;
    }

    setIsLocalLoading(true);
    setLocalError(null);

    try {
      const res = await explainService.explainLocal(sanitized);
      if (res && res.success && res.data) {
        setLocalExplanation(res.data);
        if (recordMeta) {
          setCurrentRecordInfo(recordMeta);
        }
      } else {
        throw new Error(res?.message || 'Invalid local explanation response');
      }
    } catch (err) {
      console.error('Failed to generate local SHAP explanation:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.details ||
        err.message ||
        'Failed to compute local SHAP attributions. Verify the ML service is online.';
      setLocalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLocalLoading(false);
    }
  }, [activeFeatures]);

  // Handle switching presets
  const handlePresetChange = (index) => {
    setSelectedPresetIndex(index);
    const preset = samplePresets[index];
    setActiveFeatures({ ...preset.data });
    setCurrentRecordInfo({ title: preset.name, id: null });
    handleGenerateLocalExplanation(preset.data, { title: preset.name, id: null });
  };

  // Handle selecting a stored prediction from history
  const handleHistorySelection = async (predictionId) => {
    setSelectedHistoryId(predictionId);
    if (!predictionId) return;

    setIsLocalLoading(true);
    setLocalError(null);

    try {
      const res = await predictionService.getPredictionById(predictionId);
      if (res && res.success && res.data?.inputFeatures) {
        const features = res.data.inputFeatures;
        setActiveFeatures(features);
        const meta = {
          title: `Stored #${res.data._id.slice(-6).toUpperCase()} (${res.data.attackCategory})`,
          id: res.data._id,
          category: res.data.attackCategory,
          createdAt: res.data.createdAt,
          isAttack: res.data.isAttack,
        };
        setCurrentRecordInfo(meta);

        // Request local explanation using predictionId so backend uses saved classification routing
        try {
          const explainRes = await explainService.explainLocal({ predictionId: res.data._id });
          if (explainRes && explainRes.success && explainRes.data) {
            setLocalExplanation(explainRes.data);
            return;
          }
        } catch {
          // fallback to explaining by features
        }
        await handleGenerateLocalExplanation(features, meta);
      } else {
        throw new Error('Prediction inputFeatures could not be retrieved.');
      }
    } catch (err) {
      console.error('Failed to load history prediction details:', err);
      setLocalError(err.response?.data?.message || err.message || 'Failed to load stored prediction.');
    } finally {
      setIsLocalLoading(false);
    }
  };

  // Auto-load if navigated with query param or state
  useEffect(() => {
    const queryPredId = searchParams.get('predictionId') || location.state?.predictionId;
    if (queryPredId) {
      setActiveTab('local');
      setInputSource('history');
      handleHistorySelection(queryPredId);
    } else if (location.state?.inputFeatures) {
      setActiveTab('local');
      setActiveFeatures(location.state.inputFeatures);
      const meta = {
        title: location.state.title || 'Evaluated Connection Record',
        id: location.state.predictionId || null,
      };
      setCurrentRecordInfo(meta);
      handleGenerateLocalExplanation(location.state.inputFeatures, meta);
    }
  }, [searchParams, location.state]);

  // Max importance for scaling global bars (supports both multiclass f.importance and binary f.mean_abs_shap)
  const maxGlobalImportance = useMemo(() => {
    if (!globalData?.top_features?.length) return 1;
    const vals = globalData.top_features.map((f) => {
      const v = f.importance !== undefined
        ? f.importance
        : (f.mean_abs_shap !== undefined ? f.mean_abs_shap : f.shap_value);
      const n = Number(v);
      return !isNaN(n) && isFinite(n) ? n : 0;
    });
    return Math.max(...vals, 0.001);
  }, [globalData]);

  // Max SHAP absolute value for scaling local bars
  const maxLocalShap = useMemo(() => {
    if (!localExplanation) return 0.5;
    const posMax = Math.max(...(localExplanation.top_positive || []).map((p) => Math.abs(p.shap_value || 0)), 0);
    const negMax = Math.max(...(localExplanation.top_negative || []).map((n) => Math.abs(n.shap_value || 0)), 0);
    return Math.max(posMax, negMax, 0.1);
  }, [localExplanation]);

  // Check if explanation is binary vs multiclass
  const isBinaryExplanation = localExplanation?.explanation_type === 'binary_stage1';

  // Check if predicted class is malicious or normal
  const isMalicious =
    localExplanation &&
    (localExplanation.predicted_class || localExplanation.attack_category || '').toLowerCase() !== 'normal';

  // Calculate sum of contributions
  const sumOfContributions = useMemo(() => {
    if (!localExplanation?.contributions) return 0;
    return Object.values(localExplanation.contributions).reduce((acc, val) => acc + (Number(val) || 0), 0);
  }, [localExplanation]);

  // Model output margin score: base_value + sum(contributions)
  const targetMarginScore = useMemo(() => {
    if (!localExplanation) return 0;
    if (isBinaryExplanation && localExplanation.raw_log_odds_margin !== undefined) {
      return Number(localExplanation.raw_log_odds_margin);
    }
    return (localExplanation.base_value || 0) + sumOfContributions;
  }, [localExplanation, isBinaryExplanation, sumOfContributions]);

  return (
    <div className="space-y-6">
      {/* Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-500" />
            <span>Explainable AI (XAI) Console</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            SHAP TreeExplainer feature attributions for model transparency and auditability
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#0F172A] p-1 rounded-xl border border-[#1E293B] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'global'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Global Importance (Top 20)
          </button>
          <button
            onClick={() => {
              setActiveTab('local');
              if (!localExplanation && !isLocalLoading) {
                handleGenerateLocalExplanation();
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'local'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Local Attribution (Record SHAP)
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: Global Feature Importance                                     */}
      {/* ===================================================================== */}
      {activeTab === 'global' && (
        <div className="space-y-6">
          {/* Model Type Selector Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0F172A] p-2.5 rounded-2xl border border-[#1E293B] gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Select Model for Global Attributions:</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleGlobalModelTypeChange('binary')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  globalModelType === 'binary'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-semibold'
                    : 'bg-[#080C16] text-slate-400 hover:text-white border border-[#1E293B]'
                }`}
              >
                Stage 1: Binary Intrusion Detector
              </button>
              <button
                type="button"
                onClick={() => handleGlobalModelTypeChange('multiclass')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  globalModelType === 'multiclass'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 font-semibold'
                    : 'bg-[#080C16] text-slate-400 hover:text-white border border-[#1E293B]'
                }`}
              >
                Stage 2: 10-Class Multiclass Model
              </button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b border-[#1E293B]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <span>
                    {globalModelType === 'binary'
                      ? 'Stage 1 Binary Detector — Global Feature Importance (Top 20)'
                      : 'Stage 2 Multiclass Model — Global Feature Importance (Top 20)'}
                  </span>
                </CardTitle>

                <div className="flex items-center space-x-2 flex-wrap">
                  {globalModelType === 'binary' && globalData?.base_value_log_odds !== undefined && (
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-800/40">
                      Base Log-Odds: {typeof globalData.base_value_log_odds === 'number' ? globalData.base_value_log_odds.toFixed(4) : globalData.base_value_log_odds}
                    </span>
                  )}
                  <Badge variant={globalModelType === 'binary' ? 'primary' : 'purple'}>
                    {globalData?.total_features || 194} Transformed Features
                  </Badge>
                  <button
                    onClick={() => fetchGlobalExplanations(globalModelType)}
                    disabled={isGlobalLoading}
                    className="p-1.5 bg-[#080C16] border border-[#1E293B] hover:border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Refresh Global Importance"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGlobalLoading ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Error Banner */}
              {globalError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-300 text-xs">
                  <div className="flex items-center space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{globalError}</span>
                  </div>
                  <button
                    onClick={() => fetchGlobalExplanations(globalModelType)}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg font-medium text-rose-200 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading Skeleton */}
              {isGlobalLoading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 text-xs">
                      <Skeleton className="w-8 h-4" />
                      <Skeleton className="w-36 h-4" />
                      <Skeleton className="w-24 h-4 hidden sm:block" />
                      <Skeleton className="flex-1 h-3 rounded-full" />
                      <Skeleton className="w-16 h-4" />
                    </div>
                  ))}
                </div>
              ) : globalData?.top_features?.length > 0 ? (
                /* Feature List */
                <div className="space-y-3">
                  {globalData.top_features.map((item, idx) => {
                    // Feature identification across Multiclass (feature) and Binary (clean_name / raw_feature_name)
                    const featureName = item.feature || item.clean_name || item.raw_feature_name || `Feature #${item.rank || idx + 1}`;
                    const featureKey = item.raw_feature_name || item.feature || item.clean_name || `feat-${item.rank || idx}`;
                    
                    // Feature importance metric across Multiclass (importance) and Binary (mean_abs_shap / shap_value)
                    const rawImportance = item.importance !== undefined
                      ? item.importance
                      : (item.mean_abs_shap !== undefined ? item.mean_abs_shap : item.shap_value);
                    const numImportance = Number(rawImportance);
                    const isValidImportance = typeof rawImportance !== 'undefined' && rawImportance !== null && !isNaN(numImportance) && isFinite(numImportance);

                    const percent = isValidImportance && maxGlobalImportance > 0
                      ? Math.min(Math.max(Math.round((numImportance / maxGlobalImportance) * 100), 2), 100)
                      : 0;
                    const category = getFeatureCategory(item.raw_feature_name || item.feature || featureName);

                    return (
                      <div
                        key={featureKey}
                        className="flex items-center text-xs py-1 px-2 rounded-lg hover:bg-[#080C16]/50 transition-colors"
                      >
                        <span className="w-8 font-mono text-slate-500 font-semibold">
                          #{item.rank || idx + 1}
                        </span>
                        <span
                          className="w-44 font-mono text-slate-200 font-medium truncate"
                          title={`${featureName}${item.raw_feature_name ? ` (${item.raw_feature_name})` : ''}`}
                        >
                          {featureName}
                        </span>
                        <span className="w-28 text-slate-400 text-[11px] hidden sm:inline-block">
                          <span className="px-1.5 py-0.5 rounded bg-[#080C16] border border-[#1E293B] text-[10px] text-slate-300">
                            {category}
                          </span>
                        </span>
                        <div className="flex-1 h-2.5 bg-[#080C16] rounded-full overflow-hidden mx-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              globalModelType === 'binary'
                                ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400'
                                : 'bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="w-20 font-mono font-bold text-slate-100 text-right">
                          {isValidImportance ? numImportance.toFixed(4) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty State */
                <div className="py-12 text-center text-slate-400">
                  <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-300">No Global Features Loaded</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Check that the ML service and SHAP summary artifacts are present.
                  </p>
                </div>
              )}

              {/* Explanatory Info Card */}
              <div className="p-3.5 rounded-xl bg-[#080C16]/70 border border-[#1E293B] flex items-start space-x-2.5 text-slate-400 text-xs mt-4">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px] space-y-1">
                  <p>
                    <strong className="text-slate-200">
                      {globalModelType === 'binary'
                        ? 'Stage 1 Binary Detector SHAP (Log-Odds Margin Impact)'
                        : 'Stage 2 Multiclass Model SHAP (10-Class Anomaly Profiles)'}
                      :
                    </strong>{' '}
                    {globalModelType === 'binary'
                      ? 'Global importance reflects the mean absolute SHAP value across the binary detector training distribution. Features such as sttl, ct_state_ttl, and rate govern the primary boundary between Benign Normal and Attack traffic.'
                      : 'Global importance reflects the mean absolute SHAP value across the 10 UNSW-NB15 attack categories. These features govern the multiclass triage separating specific malicious tactics (DoS, Exploits, Generic, Reconnaissance, etc.).'}
                  </p>
                  <p className="text-slate-500">
                    Units: Mean absolute margin log-odds (|SHAP|). These values represent shifts in model logits, not direct probabilities.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: Local Feature Attribution (SHAP)                               */}
      {/* ===================================================================== */}
      {activeTab === 'local' && (
        <div className="space-y-6">
          {/* Connection Record Source Selector */}
          <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
                <Database className="w-4 h-4 text-blue-400" />
                <span>Explain Record From:</span>
              </div>

              {/* Toggle Source: Preset vs History */}
              <div className="flex items-center space-x-1.5 bg-[#080C16] p-1 rounded-xl border border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setInputSource('preset')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    inputSource === 'preset'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sample Preset
                </button>
                <button
                  type="button"
                  onClick={() => setInputSource('history')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    inputSource === 'history'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Prediction History ({historyPredictions.length})
                </button>
              </div>
            </div>

            {/* Target Selector Dropdown */}
            <div className="flex items-center space-x-2">
              {inputSource === 'preset' ? (
                <select
                  value={selectedPresetIndex}
                  onChange={(e) => handlePresetChange(Number(e.target.value))}
                  className="bg-[#080C16] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  {samplePresets.map((preset, idx) => (
                    <option key={idx} value={idx}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedHistoryId}
                  onChange={(e) => handleHistorySelection(e.target.value)}
                  className="bg-[#080C16] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 shadow-sm max-w-xs"
                >
                  <option value="">-- Choose from History --</option>
                  {historyPredictions.map((pred) => (
                    <option key={pred._id} value={pred._id}>
                      #{pred._id.slice(-6).toUpperCase()} — {pred.attackCategory} (
                      {(pred.confidence * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant="primary"
                size="sm"
                icon={Zap}
                loading={isLocalLoading}
                onClick={() => handleGenerateLocalExplanation()}
                disabled={isLocalLoading}
              >
                Explain with SHAP
              </Button>
            </div>
          </div>

          {/* Local Attribution Error Banner */}
          {localError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-300 text-xs">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{localError}</span>
              </div>
              <button
                onClick={() => handleGenerateLocalExplanation()}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg font-medium text-rose-200 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Local Result Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Summary Card (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card glow={isMalicious}>
                <CardHeader className="pb-3 border-b border-[#1E293B]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Evaluated Prediction</span>
                    </CardTitle>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {isBinaryExplanation ? 'Stage 1 Binary SHAP' : 'Stage 2 Multiclass SHAP'}
                      </span>
                      <Badge variant={isMalicious ? 'malicious' : 'normal'} dot>
                        {isMalicious ? 'Threat Detected' : 'Benign Traffic'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4 text-xs">
                  {/* Outcome Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center space-x-3.5 ${
                      isMalicious
                        ? 'bg-rose-950/40 border-rose-800/50 text-rose-200 shadow-glow-red'
                        : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200 shadow-glow-green'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isMalicious ? 'bg-rose-600/20 text-rose-400' : 'bg-emerald-600/20 text-emerald-400'
                      }`}
                    >
                      {isMalicious ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                        {isBinaryExplanation ? 'Stage 1 Binary Class' : 'Stage 2 Attack Category'}
                      </p>
                      <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                        {localExplanation?.predicted_class || 'Analyzing...'}
                      </h3>
                      <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                        {isBinaryExplanation
                          ? `Attack Prob: ${((localExplanation?.attack_probability ?? 0) * 100).toFixed(2)}% | Threshold: 32.5%`
                          : `Multiclass Confidence: ${((localExplanation?.confidence ?? 0) * 100).toFixed(2)}%`}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="p-3.5 rounded-xl bg-[#080C16] border border-[#1E293B] space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Model Base Value ($\phi_0$ Log-Odds):</span>
                      <span className="font-mono text-white font-semibold">
                        {typeof localExplanation?.base_value === 'number'
                          ? localExplanation.base_value >= 0
                            ? `+${localExplanation.base_value.toFixed(4)}`
                            : localExplanation.base_value.toFixed(4)
                          : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Net Feature Contributions ($\sum \phi_i$):</span>
                      <span
                        className={`font-mono font-semibold ${
                          sumOfContributions >= 0 ? 'text-rose-400' : 'text-blue-400'
                        }`}
                      >
                        {sumOfContributions >= 0
                          ? `+${sumOfContributions.toFixed(4)}`
                          : sumOfContributions.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#1E293B]">
                      <span className="text-slate-300 font-medium">Model Output Margin Score:</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {targetMarginScore >= 0
                          ? `+${targetMarginScore.toFixed(4)}`
                          : targetMarginScore.toFixed(4)}
                      </span>
                    </div>

                    {isBinaryExplanation ? (
                      <>
                        <div className="flex justify-between items-center pt-1 border-t border-[#1E293B]/60">
                          <span className="text-slate-400">Binary Attack Probability:</span>
                          <span
                            className={`font-mono font-semibold ${
                              isMalicious ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {((localExplanation?.attack_probability ?? 0) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Decision Threshold:</span>
                          <span className="font-mono font-semibold text-amber-400">
                            {((localExplanation?.threshold ?? 0.325) * 100).toFixed(1)}%
                          </span>
                        </div>
                        {localExplanation?.additivity_verified !== undefined && (
                          <div className="flex justify-between items-center pt-1 border-t border-[#1E293B]/60">
                            <span className="text-slate-400">Additivity Verification:</span>
                            <span
                              className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded flex items-center space-x-1 ${
                                localExplanation.additivity_verified
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                              }`}
                            >
                              <CheckCircle className="w-3 h-3 inline mr-1 text-emerald-400" />
                              <span>
                                {localExplanation.additivity_verified
                                  ? `Verified (err: ${Number(localExplanation.additivity_error || 0).toExponential(2)})`
                                  : 'Unverified'}
                              </span>
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between items-center pt-1 border-t border-[#1E293B]/60">
                        <span className="text-slate-400">Inference Confidence:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {typeof localExplanation?.confidence === 'number'
                            ? `${(localExplanation.confidence * 100).toFixed(2)}%`
                            : '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Explicit SHAP Domain Clarification Note */}
                  <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 text-blue-200/90 text-[11px] leading-relaxed flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-300">
                        {isBinaryExplanation
                          ? 'Stage 1 Binary SHAP Log-Odds Margin Interpretation:'
                          : 'Stage 2 Multiclass SHAP Margin Interpretation:'}
                      </p>
                      <p className="mt-0.5 text-blue-300/80">
                        {isBinaryExplanation
                          ? 'SHAP values represent additive shifts to the binary detector raw output margin (log-odds / logit space), NOT direct probabilities. Positive values (+SHAP) push the model toward the Attack decision boundary; negative values (-SHAP) push toward Normal.'
                          : 'SHAP values represent additive shifts to the multiclass model margin for this specific predicted attack class, NOT probabilities. Positive values increase support for this category over other intrusion types.'}
                      </p>
                    </div>
                  </div>

                  {/* Record Metadata */}
                  <div className="p-3 rounded-xl bg-[#080C16]/50 border border-[#1E293B] text-[11px] space-y-1 text-slate-400">
                    <p className="text-slate-300 font-medium truncate">
                      Source Record: {currentRecordInfo.title}
                    </p>
                    {currentRecordInfo.id && (
                      <p className="font-mono text-slate-400">
                        ID: #{currentRecordInfo.id}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Horizontal Contribution Visual (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b border-[#1E293B]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Feature Attributions (Top Contributors)</span>
                    </CardTitle>

                    {/* Filter Mode Buttons */}
                    <div className="flex items-center space-x-1 bg-[#080C16] p-1 rounded-lg border border-[#1E293B] text-[11px]">
                      <button
                        onClick={() => setLocalViewMode('diverging')}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          localViewMode === 'diverging'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Diverging View
                      </button>
                      <button
                        onClick={() => setLocalViewMode('positive')}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          localViewMode === 'positive'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Top Positive (10)
                      </button>
                      <button
                        onClick={() => setLocalViewMode('negative')}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          localViewMode === 'negative'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Top Negative (10)
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {isLocalLoading ? (
                    <div className="space-y-4 py-8">
                      <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                        <p className="text-xs font-semibold text-white">Computing SHAP Explanations...</p>
                        <p className="text-[11px] text-slate-500">
                          Calculating TreeExplainer attributions across 194 transformed features
                        </p>
                      </div>
                      <div className="space-y-2 pt-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-6 w-full rounded" />
                        ))}
                      </div>
                    </div>
                  ) : localExplanation ? (
                    <div className="space-y-5">
                      {/* DIVERGING VIEW: Positive and Negative features combined */}
                      {localViewMode === 'diverging' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1 border-b border-[#1E293B] pb-1.5">
                            <span className="text-blue-400">◄ Pushing Away (-)</span>
                            <span>Baseline 0.0</span>
                            <span className="text-rose-400">Pushing Toward (+) ►</span>
                          </div>

                          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                            {/* Positive contributors first */}
                            {(localExplanation.top_positive || []).map((item) => {
                              const numShap = Number(item.shap_value);
                              const isValidShap = typeof item.shap_value !== 'undefined' && item.shap_value !== null && !isNaN(numShap) && isFinite(numShap);
                              const percent = isValidShap && maxLocalShap > 0
                                ? Math.min((Math.abs(numShap) / maxLocalShap) * 100, 100)
                                : 0;
                              return (
                                <div key={item.feature} className="flex items-center text-xs">
                                  <span
                                    className="w-32 font-mono text-slate-300 truncate font-medium text-right pr-2"
                                    title={`${item.feature} (value: ${item.feature_value})`}
                                  >
                                    {item.feature}
                                  </span>

                                  {/* Center Diverging Bar */}
                                  <div className="flex-1 flex items-center h-6 bg-[#080C16] rounded px-1 relative">
                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700 z-10" />
                                    <div className="w-1/2 flex justify-end pr-0.5" />
                                    <div className="w-1/2 flex justify-start pl-0.5">
                                      <div
                                        className="h-3.5 rounded-r bg-gradient-to-r from-rose-600 to-rose-400 shadow-sm shadow-rose-500/40 transition-all duration-300"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                  </div>

                                  <span className="w-20 text-right font-mono font-bold text-rose-400 pl-2">
                                    {isValidShap ? `+${numShap.toFixed(4)}` : '—'}
                                  </span>
                                </div>
                              );
                            })}

                            {/* Negative contributors */}
                            {(localExplanation.top_negative || []).map((item) => {
                              const numShap = Number(item.shap_value);
                              const isValidShap = typeof item.shap_value !== 'undefined' && item.shap_value !== null && !isNaN(numShap) && isFinite(numShap);
                              const percent = isValidShap && maxLocalShap > 0
                                ? Math.min((Math.abs(numShap) / maxLocalShap) * 100, 100)
                                : 0;
                              return (
                                <div key={item.feature} className="flex items-center text-xs">
                                  <span
                                    className="w-32 font-mono text-slate-300 truncate font-medium text-right pr-2"
                                    title={`${item.feature} (value: ${item.feature_value})`}
                                  >
                                    {item.feature}
                                  </span>

                                  {/* Center Diverging Bar */}
                                  <div className="flex-1 flex items-center h-6 bg-[#080C16] rounded px-1 relative">
                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700 z-10" />
                                    <div className="w-1/2 flex justify-end pr-0.5">
                                      <div
                                        className="h-3.5 rounded-l bg-gradient-to-l from-blue-600 to-blue-400 shadow-sm shadow-blue-500/40 transition-all duration-300"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                    <div className="w-1/2 flex justify-start pl-0.5" />
                                  </div>

                                  <span className="w-20 text-right font-mono font-bold text-blue-400 pl-2">
                                    {isValidShap ? numShap.toFixed(4) : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* POSITIVE ONLY VIEW (Top 10) */}
                      {localViewMode === 'positive' && (
                        <div className="space-y-3">
                          <p className="text-[11px] text-slate-400">
                            Features providing the highest positive margin support toward classifying this connection as{' '}
                            <strong className="text-white">{localExplanation.predicted_class}</strong>:
                          </p>

                          <div className="space-y-2">
                            {(localExplanation.top_positive || []).map((item, idx) => {
                              const numShap = Number(item.shap_value);
                              const isValidShap = typeof item.shap_value !== 'undefined' && item.shap_value !== null && !isNaN(numShap) && isFinite(numShap);
                              const percent = isValidShap && maxLocalShap > 0
                                ? Math.min((Math.abs(numShap) / maxLocalShap) * 100, 100)
                                : 0;
                              return (
                                <div
                                  key={item.feature}
                                  className="flex items-center justify-between p-2 rounded-xl bg-[#080C16] border border-[#1E293B]/60 text-xs"
                                >
                                  <div className="flex items-center space-x-2 min-w-0 flex-1 pr-3">
                                    <span className="font-mono text-slate-500 w-5">#{idx + 1}</span>
                                    <span
                                      className="font-mono text-slate-200 font-medium truncate"
                                      title={item.feature}
                                    >
                                      {item.feature}
                                    </span>
                                    {item.feature_value !== null && item.feature_value !== undefined && (
                                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                        (val: {typeof item.feature_value === 'number' ? item.feature_value.toFixed(2) : item.feature_value})
                                      </span>
                                    )}
                                  </div>

                                  <div className="w-32 h-2.5 bg-[#0F172A] rounded-full overflow-hidden mx-2 hidden sm:block">
                                    <div
                                      className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>

                                  <span className="font-mono font-bold text-rose-400 w-20 text-right">
                                    {isValidShap ? `+${numShap.toFixed(4)}` : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* NEGATIVE ONLY VIEW (Top 10) */}
                      {localViewMode === 'negative' && (
                        <div className="space-y-3">
                          <p className="text-[11px] text-slate-400">
                            Features providing counter-attributions that push against classifying this connection as{' '}
                            <strong className="text-white">{localExplanation.predicted_class}</strong>:
                          </p>

                          <div className="space-y-2">
                            {(localExplanation.top_negative || []).map((item, idx) => {
                              const numShap = Number(item.shap_value);
                              const isValidShap = typeof item.shap_value !== 'undefined' && item.shap_value !== null && !isNaN(numShap) && isFinite(numShap);
                              const percent = isValidShap && maxLocalShap > 0
                                ? Math.min((Math.abs(numShap) / maxLocalShap) * 100, 100)
                                : 0;
                              return (
                                <div
                                  key={item.feature}
                                  className="flex items-center justify-between p-2 rounded-xl bg-[#080C16] border border-[#1E293B]/60 text-xs"
                                >
                                  <div className="flex items-center space-x-2 min-w-0 flex-1 pr-3">
                                    <span className="font-mono text-slate-500 w-5">#{idx + 1}</span>
                                    <span
                                      className="font-mono text-slate-200 font-medium truncate"
                                      title={item.feature}
                                    >
                                      {item.feature}
                                    </span>
                                    {item.feature_value !== null && item.feature_value !== undefined && (
                                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                        (val: {typeof item.feature_value === 'number' ? item.feature_value.toFixed(2) : item.feature_value})
                                      </span>
                                    )}
                                  </div>

                                  <div className="w-32 h-2.5 bg-[#0F172A] rounded-full overflow-hidden mx-2 hidden sm:block">
                                    <div
                                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>

                                  <span className="font-mono font-bold text-blue-400 w-20 text-right">
                                    {isValidShap ? numShap.toFixed(4) : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Initial Empty State */
                    <div className="py-16 text-center text-slate-400">
                      <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-300">No Record Explanation Generated</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                        Choose a connection record above and click "Explain with SHAP" to view its exact feature contributions.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainabilityPage;
