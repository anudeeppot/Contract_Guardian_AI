import { motion } from 'framer-motion';
import { RiskBadge } from '../ui/RiskBadge';
import type { RiskLevel } from '../../types';

export function RiskMeter({ score }: { score: number }) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const level: RiskLevel =
    normalizedScore >= 80 ? 'critical' : normalizedScore >= 50 ? 'high' : normalizedScore >= 25 ? 'medium' : 'low';

  // SVG Gauge Math for a 180-degree semi-circle
  const radius = 72;
  const circumference = Math.PI * radius; // ~226.19
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  const colorMap: Record<RiskLevel, string> = {
    low: '#48d597',
    medium: '#fde047',
    high: '#ffb454',
    critical: '#ff5f6d',
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-300">Contract Risk Score</span>
        <RiskBadge level={level} />
      </div>

      <div className="relative mt-2 flex items-center justify-center">
        <svg width="200" height="115" viewBox="0 0 200 115" className="overflow-visible">
          <defs>
            <linearGradient id="riskArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#48d597" />
              <stop offset="35%" stopColor="#fde047" />
              <stop offset="70%" stopColor="#ffb454" />
              <stop offset="100%" stopColor="#ff5f6d" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={colorMap[level]} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 28 100 A 72 72 0 0 1 172 100"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Animated Value Arc */}
          <motion.path
            d="M 28 100 A 72 72 0 0 1 172 100"
            fill="none"
            stroke="url(#riskArcGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            filter="url(#glow)"
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute bottom-1 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold tracking-tight text-white">{normalizedScore}</span>
          <span className="text-xs uppercase tracking-wider text-slate-400">out of 100</span>
        </div>
      </div>

      {/* Tiers Legend */}
      <div className="mt-3 flex w-full max-w-xs items-center justify-between px-1 text-[11px] font-medium text-slate-400">
        <span className="text-legal-green">0-24 Low</span>
        <span className="text-yellow-300">25-49 Med</span>
        <span className="text-legal-amber">50-79 High</span>
        <span className="text-legal-red">80+ Crit</span>
      </div>
    </div>
  );
}

export function DonutChart({
  title,
  values,
}: {
  title: string;
  values: { label: string; value: number; color: string }[];
}) {
  const total = values.reduce((sum, item) => sum + item.value, 0);

  let start = 0;
  const gradient =
    total > 0
      ? values
          .filter((item) => item.value > 0)
          .map((item) => {
            const pct = (item.value / total) * 100;
            const end = start + pct;
            const segment = `${item.color} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
            start = end;
            return segment;
          })
          .join(', ')
      : 'rgba(255, 255, 255, 0.1) 0% 100%';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-400">Total: {total}</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div
          className="relative h-32 w-32 shrink-0 rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ background: `conic-gradient(${gradient})` }}
          aria-label={title}
        >
          <div className="absolute inset-4 rounded-full bg-panel flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-white leading-none">{total}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">items</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full">
          {values.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <span>{item.value}</span>
                  <span className="text-[10px] text-slate-500 font-normal">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ConfidenceGauge({ value }: { value: number }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const rating = score >= 85 ? 'High Confidence' : score >= 65 ? 'Moderate' : 'Needs Verification';
  const ratingColor =
    score >= 85 ? 'text-legal-teal' : score >= 65 ? 'text-yellow-300' : 'text-legal-amber';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-slate-300 font-medium">Model Extraction Confidence</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${ratingColor}`}>{rating}</span>
          <span className="font-bold text-legal-teal text-base">{score}%</span>
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-legal-teal to-legal-green"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Measures clause extraction fidelity, NLP classification certainty, and legal entity alignment.
        </p>
      </div>
    </div>
  );
}
