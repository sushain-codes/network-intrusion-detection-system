import React from 'react';
import { ShieldAlert, Crosshair, Clock, FileText, ShieldCheck, CheckCircle, Layers } from 'lucide-react';
import { Badge } from '../common/Badge';

const formatPredictionTime = (ts) => {
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

const formatPredictionId = (id) => {
  if (!id) return '#---';
  if (typeof id === 'string' && id.startsWith('#')) return id;
  if (typeof id === 'string' && id.length >= 6) {
    return `#${id.slice(-6).toUpperCase()}`;
  }
  return `#${id}`;
};

export const LatestPredictionCard = ({ prediction = null }) => {
  if (!prediction) {
    return (
      <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-100">
            Latest Prediction
          </h3>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50">
            No Activity
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-xs font-semibold text-slate-300">No predictions recorded</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
            Run an analysis in Network Prediction to see live classifications.
          </p>
        </div>
      </div>
    );
  }

  const isMalicious = prediction.isAttack !== undefined
    ? Boolean(prediction.isAttack)
    : (prediction.attackCategory || prediction.attack_category || 'Normal').toLowerCase() !== 'normal';
  const attackCategory = prediction.attackCategory || prediction.attack_category || (isMalicious ? 'Attack' : 'Normal');
  const routingPath = prediction.routingPath || (isMalicious ? 'stage1_and_stage2' : 'stage1_only');
  const status = isMalicious ? 'Threat Detected' : 'Benign Traffic';
  const confidence = typeof prediction.confidence === 'number'
    ? `${(prediction.confidence * 100).toFixed(1)}%`
    : (prediction.confidence || '0.00%');
  const timestamp = formatPredictionTime(prediction.createdAt || prediction.timestamp);
  const predictionId = formatPredictionId(prediction._id || prediction.id);

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-100">
          Latest Prediction
        </h3>
        <Badge variant={isMalicious ? 'malicious' : 'normal'} dot>
          {status}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs py-1 border-b border-[#1E293B]/60">
          <div className="flex items-center text-slate-400">
            {isMalicious ? (
              <ShieldAlert className="w-4 h-4 mr-2 text-rose-400" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
            )}
            <span>{isMalicious ? 'Attack Category' : 'Security Verdict'}</span>
          </div>
          <span className={`font-semibold text-sm ${isMalicious ? 'text-rose-300' : 'text-emerald-300'}`}>
            {isMalicious ? attackCategory : 'Benign / Normal'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1 border-b border-[#1E293B]/60">
          <div className="flex items-center text-slate-400">
            <Layers className="w-4 h-4 mr-2 text-purple-400" />
            <span>Routing Path</span>
          </div>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {routingPath === 'stage1_only' ? 'Stage 1 Only (Bypassed)' : 'Two-Stage Pipeline'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1 border-b border-[#1E293B]/60">
          <div className="flex items-center text-slate-400">
            <Crosshair className="w-4 h-4 mr-2 text-cyan-400" />
            <span>Confidence</span>
          </div>
          <span className="font-semibold text-white font-mono text-sm">
            {confidence}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1 border-b border-[#1E293B]/60">
          <div className="flex items-center text-slate-400">
            <Clock className="w-4 h-4 mr-2 text-blue-400" />
            <span>Time</span>
          </div>
          <span className="font-medium text-slate-200">
            {timestamp}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center text-slate-400">
            <FileText className="w-4 h-4 mr-2 text-cyan-400" />
            <span>Prediction ID</span>
          </div>
          <span className="font-mono font-medium text-slate-300">
            {predictionId}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LatestPredictionCard;
