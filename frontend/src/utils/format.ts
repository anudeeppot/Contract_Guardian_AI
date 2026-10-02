import type { RiskLevel } from '../types';

export const riskColor: Record<RiskLevel, string> = {
  low: 'text-legal-green border-legal-green/30 bg-legal-green/10',
  medium: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/10',
  high: 'text-legal-amber border-legal-amber/30 bg-legal-amber/10',
  critical: 'text-legal-red border-legal-red/30 bg-legal-red/10',
};

export const riskFill: Record<RiskLevel, string> = {
  low: 'bg-legal-green',
  medium: 'bg-yellow-300',
  high: 'bg-legal-amber',
  critical: 'bg-legal-red',
};

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function prettyDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function normalizeRisk(value: string | undefined): RiskLevel {
  const normalized = (value ?? 'low').toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'low';
}

export function normalizeStatus(value: string | undefined) {
  return (value ?? 'uploaded').toLowerCase();
}
