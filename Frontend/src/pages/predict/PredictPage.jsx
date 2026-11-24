import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ShieldAlert,
  CheckCircle,
  Zap,
  RefreshCw,
  Cpu,
  Search,
  AlertTriangle,
  Clock,
  FileText,
  ExternalLink,
  XCircle,
  Layers,
  GitBranch,
  Crosshair,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { samplePresets } from '../../data/mockData';
import {
  FEATURE_GROUPS,
  FEATURES_METADATA,
  validateFeaturePayload,
} from '../../data/featureMetadata';
import predictionService from '../../services/prediction.service';

const formatDateTime = (ts) => {
  if (!ts) return 'Just now';
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

const formatPredictionId = (id) => {
  if (!id) return '#---';
  const strId = String(id);
  if (strId.length >= 6) {
    return `#PRD-${strId.slice(-6).toUpperCase()}`;
  }
  return `#${strId}`;
};

export const PredictPage = () => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [formData, setFormData] = useState({ ...samplePresets[0].data });
  const [activeGroup, setActiveGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);

  // Switch presets
  const handlePresetChange = (index) => {
    setSelectedPreset(index);
    setFormData({ ...samplePresets[index].data });
    setValidationErrors({});
    setApiError(null);
  };

  // Reset form to currently selected preset
  const handleReset = () => {
    setFormData({ ...samplePresets[selectedPreset].data });
    setValidationErrors({});
    setApiError(null);
  };

  // Handle single field change
  const handleInputChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear validation error for this field if user starts fixing it
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  // Filter features based on active group tab and search query
  const filteredFeatures = useMemo(() => {
    return FEATURES_METADATA.filter((feat) => {
      const matchesGroup = activeGroup === 'all' || feat.group === activeGroup;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        feat.name.toLowerCase().includes(q) ||
        feat.label.toLowerCase().includes(q) ||
        feat.description.toLowerCase().includes(q);
      return matchesGroup && matchesSearch;
    });
  }, [activeGroup, searchQuery]);

  // Form submission: Validate and call POST /api/predictions
  const handlePredict = async () => {
    setApiError(null);

    // 1. Validate all 42 required features
    const { isValid, errors, payload } = validateFeaturePayload(formData);
    if (!isValid) {
      setValidationErrors(errors);
      const firstErrorKey = Object.keys(errors)[0];
      setApiError(
        `Validation failed for ${Object.keys(errors).length} feature(s): ${
          errors[firstErrorKey]
        }. Please correct them before submitting.`
      );
      return;
    }

    setValidationErrors({});
    setIsPredicting(true);

    try {
      const response = await predictionService.predict(payload);
      if (response && response.success && response.data) {
        setPredictionResult(response.data);
      } else {
        throw new Error(response?.message || 'Invalid prediction response received');
      }
    } catch (err) {
      console.error('Prediction request error:', err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.details ||
        err.message ||
        'Failed to generate prediction. Please check that the ML service is online.';
      setApiError(typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage));
    } finally {
      setIsPredicting(false);
    }
  };

  const isMalicious =
    predictionResult &&
    (predictionResult.is_attack !== undefined
      ? Boolean(predictionResult.is_attack)
      : (predictionResult.attack_category || predictionResult.prediction || '').toLowerCase() !== 'normal');

  const stage1Binary = predictionResult?.stage1_binary || predictionResult?.stage1Binary || null;
  const stage2Multiclass = predictionResult?.stage2_multiclass || predictionResult?.stage2Multiclass || null;
  const routingPath = predictionResult?.routing_path || predictionResult?.routingPath || (isMalicious ? 'stage1_and_stage2' : 'stage1_only');
  const stage2Ran = routingPath === 'stage1_and_stage2' && stage2Multiclass !== null;

  // Stage 1 specific calculations
  const stage1AttackProb = stage1Binary?.attack_probability !== undefined
    ? Number(stage1Binary.attack_probability)
    : (isMalicious ? (predictionResult?.confidence || 1) : (1 - (predictionResult?.confidence || 0.999)));
  const stage1Threshold = stage1Binary?.threshold !== undefined ? Number(stage1Binary.threshold) : 0.325;
  const stage1Confidence = isMalicious
    ? stage1AttackProb
    : (1 - stage1AttackProb);

  // Stage 2 Multiclass probabilities (ONLY when Stage 2 actually ran)
  const multiclassProbabilities = useMemo(() => {
    if (!stage2Ran || !stage2Multiclass?.probabilities) return [];
    return Object.entries(stage2Multiclass.probabilities)
      .map(([cat, prob]) => ({
        category: cat,
        probability: Number(prob),
        percentage: Number((Number(prob) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.probability - a.probability);
  }, [stage2Ran, stage2Multiclass]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-500" />
            <span>Network Traffic Prediction</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Submit raw 42-feature connection metrics to the XGBoost inference engine
          </p>
        </div>

        {/* Quick Presets Picker */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-medium">Sample Preset:</span>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(Number(e.target.value))}
            className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-blue-500 shadow-sm"
          >
            {samplePresets.map((preset, idx) => (
              <option key={idx} value={idx}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Form Left (7 cols), Result Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Feature Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-[#1E293B]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                  <span>Raw Connection Features</span>
                  <span className="text-xs font-mono text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-800/40">
                    42 Features
                  </span>
                </CardTitle>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  title="Reset form to preset values"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset to Preset</span>
                </button>
              </div>

              {/* Group Tabs & Search Bar */}
              <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
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

                {/* Quick Search */}
                <div className="relative min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search feature..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#080C16] border border-[#1E293B] rounded-lg pl-8 pr-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Validation or API Error Banner */}
              {apiError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start space-x-2.5 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-200">Prediction Notice</p>
                    <p className="text-rose-300/80 mt-0.5 leading-relaxed">{apiError}</p>
                  </div>
                </div>
              )}

              {/* Scrollable Features Grid */}
              <div className="max-h-[480px] overflow-y-auto pr-1">
                {filteredFeatures.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredFeatures.map((feat) => {
                      const hasError = !!validationErrors[feat.name];
                      const val = formData[feat.name] !== undefined ? formData[feat.name] : '';

                      return (
                        <div
                          key={feat.name}
                          className="bg-[#080C16]/50 border border-[#1E293B]/70 rounded-xl p-2.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label
                              htmlFor={`feat-${feat.name}`}
                              className="text-[11px] font-mono font-medium text-slate-300 truncate"
                              title={`${feat.name}: ${feat.description}`}
                            >
                              {feat.name}
                            </label>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                                feat.type === 'str'
                                  ? 'bg-purple-950/70 text-purple-400 border border-purple-800/40'
                                  : feat.type === 'float'
                                  ? 'bg-blue-950/70 text-blue-400 border border-blue-800/40'
                                  : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                              }`}
                            >
                              {feat.type}
                            </span>
                          </div>

                          <input
                            id={`feat-${feat.name}`}
                            type="text"
                            value={val}
                            onChange={(e) => handleInputChange(feat.name, e.target.value)}
                            placeholder={feat.type === 'str' ? 'string' : '0'}
                            className={`w-full bg-[#0F172A] border rounded px-2 py-1 text-xs font-mono text-white focus:outline-none transition-colors ${
                              hasError
                                ? 'border-rose-500 focus:border-rose-400 bg-rose-950/20'
                                : 'border-[#1E293B] focus:border-blue-500'
                            }`}
                          />

                          {hasError ? (
                            <p className="text-[10px] text-rose-400 mt-1 truncate">
                              {validationErrors[feat.name]}
                            </p>
                          ) : (
                            <p
                              className="text-[10px] text-slate-500 mt-0.5 truncate"
                              title={feat.description}
                            >
                              {feat.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <p className="text-xs">No features match the filter "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-[#1E293B]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Showing {filteredFeatures.length} of 42 features mapped to XGBoost
                </span>

                <Button
                  onClick={handlePredict}
                  loading={isPredicting}
                  icon={Zap}
                  variant="primary"
                  size="md"
                  disabled={isPredicting}
                >
                  {isPredicting ? 'Analyzing...' : 'Analyze Connection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Real-time ML Prediction Result (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {predictionResult ? (
            <Card glow={isMalicious}>
              <CardHeader className="pb-3 border-b border-[#1E293B]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Two-Stage Pipeline Result</span>
                  </CardTitle>
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {routingPath === 'stage1_only' ? 'Stage 1 Only' : 'Two-Stage Pipeline'}
                    </span>
                    <Badge variant={isMalicious ? 'malicious' : 'normal'} dot>
                      {isMalicious ? 'Threat Detected' : 'Benign Traffic'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Outcome Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center space-x-4 ${
                    isMalicious
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-200 shadow-glow-red'
                      : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200 shadow-glow-green'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isMalicious ? 'bg-rose-600/20 text-rose-400' : 'bg-emerald-600/20 text-emerald-400'
                    }`}
                  >
                    {isMalicious ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider font-semibold opacity-75">
                      {isMalicious ? 'Detected Threat Category' : 'Traffic Security Verdict'}
                    </p>
                    <h3 className="text-xl font-bold tracking-tight text-white mt-0.5 truncate">
                      {isMalicious
                        ? (stage2Multiclass?.attack_category || predictionResult.attack_category || 'Attack')
                        : 'Benign / Normal Traffic'}
                    </h3>
                  </div>
                </div>

                {/* Metadata Row: ID and Timestamp */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#080C16] border border-[#1E293B] rounded-xl p-2.5">
                    <div className="flex items-center text-slate-400 mb-0.5">
                      <FileText className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                      <span>Prediction ID</span>
                    </div>
                    <span
                      className="font-mono font-medium text-slate-200 text-xs truncate block"
                      title={predictionResult.predictionId}
                    >
                      {formatPredictionId(predictionResult.predictionId)}
                    </span>
                  </div>

                  <div className="bg-[#080C16] border border-[#1E293B] rounded-xl p-2.5">
                    <div className="flex items-center text-slate-400 mb-0.5">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                      <span>Timestamp</span>
                    </div>
                    <span className="font-medium text-slate-200 text-[11px] truncate block">
                      {formatDateTime(predictionResult.createdAt)}
                    </span>
                  </div>
                </div>

                {/* STAGE 1: Binary Classification Card */}
                <div className="bg-[#080C16]/80 border border-[#1E293B] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1E293B]/70 pb-2">
                    <div className="flex items-center space-x-2">
                      <Crosshair className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-white">
                        Stage 1: Binary Intrusion Filter
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        isMalicious
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      }`}
                    >
                      {stage1Binary?.prediction || (isMalicious ? 'Attack' : 'Normal')}
                    </span>
                  </div>

                  {/* Stage 1 Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/50">
                      <span className="text-[10px] text-slate-400 block">Attack Prob</span>
                      <span className="font-mono font-bold text-xs text-white">
                        {(stage1AttackProb * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/50">
                      <span className="text-[10px] text-slate-400 block">Threshold</span>
                      <span className="font-mono font-bold text-xs text-amber-400">
                        {(stage1Threshold * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-[#0F172A] p-2 rounded-lg border border-[#1E293B]/50">
                      <span className="text-[10px] text-slate-400 block">Stage 1 Conf</span>
                      <span className="font-mono font-bold text-xs text-emerald-400">
                        {(stage1Confidence * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Threshold Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Normal (0%)</span>
                      <span className="text-amber-400 font-semibold">
                        Threshold: {(stage1Threshold * 100).toFixed(1)}%
                      </span>
                      <span>Attack (100%)</span>
                    </div>
                    <div className="relative h-2.5 bg-[#0F172A] rounded-full overflow-hidden border border-slate-800">
                      {/* Threshold Marker Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                        style={{ left: `${stage1Threshold * 100}%` }}
                        title="Decision Boundary: 32.5%"
                      />
                      {/* Attack Probability Bar */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isMalicious
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(stage1AttackProb * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">
                      {isMalicious
                        ? `Attack probability (${(stage1AttackProb * 100).toFixed(1)}%) ≥ ${(stage1Threshold * 100).toFixed(1)}% threshold → Routed to Stage 2`
                        : `Attack probability (${(stage1AttackProb * 100).toFixed(1)}%) < ${(stage1Threshold * 100).toFixed(1)}% threshold → Classified as Normal`}
                    </p>
                  </div>
                </div>

                {/* STAGE 2: Multiclass Classification OR Bypassed Notice */}
                {isMalicious && stage2Ran ? (
                  <div className="bg-[#080C16]/80 border border-[#1E293B] rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1E293B]/70 pb-2">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-semibold text-white">
                          Stage 2: Multiclass Attack Triage
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">
                        {stage2Multiclass?.attack_category || predictionResult.attack_category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-400">Multiclass Confidence</span>
                      <span className="text-white font-mono text-sm font-bold">
                        {(((stage2Multiclass?.confidence ?? predictionResult.confidence) || 0) * 100).toFixed(2)}%
                      </span>
                    </div>

                    {/* 10-Class Probabilities Breakdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Posterior Class Probabilities (10 Classes)
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">Sum: 100%</span>
                      </div>

                      <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                        {multiclassProbabilities.map(({ category, percentage }) => {
                          const isTop =
                            category.toLowerCase() ===
                            (stage2Multiclass?.attack_category || predictionResult.attack_category || '').toLowerCase();
                          const isCatNormal = category.toLowerCase() === 'normal';

                          return (
                            <div
                              key={category}
                              className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg transition-colors ${
                                isTop
                                  ? 'bg-rose-950/40 border border-rose-800/60'
                                  : 'bg-[#0F172A]/60 border border-[#1E293B]/40'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-medium ${
                                    isTop ? 'text-white font-bold' : 'text-slate-300'
                                  }`}
                                >
                                  {category}
                                </span>
                                {isTop && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase bg-rose-600/30 text-rose-300">
                                    Top Match
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2">
                                <div className="w-16 h-1.5 bg-[#0F172A] rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full rounded-full ${
                                      isCatNormal ? 'bg-emerald-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-slate-300 w-12 text-right">
                                  {percentage.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Stage 2 Bypassed Notice for Normal Traffic */
                  <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs font-semibold">
                        Stage 2 Multiclass Classification Bypassed
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                      Because Stage 1 classified this connection as benign normal traffic with high confidence, Stage 2 multiclass triage was safely bypassed. No attack categorization was performed.
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono pt-1">
                      <span className="px-1.5 py-0.5 rounded bg-[#080C16] border border-[#1E293B] text-emerald-300">
                        Routing: stage1_only
                      </span>
                      <span>Execution time optimized</span>
                    </div>
                  </div>
                )}

                {/* Quick Navigation Links */}
                <div className="pt-2 border-t border-[#1E293B]/60 flex items-center justify-between text-xs">
                  <Link
                    to="/history"
                    className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                  >
                    <span>View in History</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Link
                    to={`/explain?predictionId=${predictionResult.predictionId}`}
                    className="text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                  >
                    <span>Explain with SHAP</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Ready / Awaiting Input Placeholder Card */
            <Card>
              <CardHeader className="pb-3 border-b border-[#1E293B]">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Classification Result</span>
                  <Badge variant="outline" size="sm">
                    Ready to Analyze
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-glow-blue">
                  <Cpu className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Awaiting Connection Metrics
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Select a preset or customize connection attributes on the left, then click{' '}
                    <span className="text-blue-400 font-semibold">"Analyze Connection"</span> to run inference.
                  </p>
                </div>

                <div className="w-full max-w-xs bg-[#080C16] border border-[#1E293B] rounded-xl p-3 text-left space-y-1 mt-2">
                  <p className="text-[11px] font-medium text-slate-400">Current Loaded Preset:</p>
                  <p className="text-xs font-semibold text-white truncate">
                    {samplePresets[selectedPreset]?.name}
                  </p>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono pt-1">
                    <span>Protocol: {formData.proto || 'tcp'}</span>
                    <span>Service: {formData.service || '-'}</span>
                    <span>State: {formData.state || 'FIN'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictPage;
