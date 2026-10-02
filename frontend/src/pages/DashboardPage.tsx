import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, FileSearch, ShieldCheck, UploadCloud, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listContracts } from '../api/contracts';
import { getHistory } from '../api/analysis';
import type { Analysis, ContractFile } from '../types';
import { RiskMeter, DonutChart, ConfidenceGauge } from '../components/charts/Charts';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskBadge } from '../components/ui/RiskBadge';
import { fileSize, normalizeRisk, normalizeStatus, prettyDate } from '../utils/format';

export function DashboardPage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractFile[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  useEffect(() => {
    listContracts().then(setContracts).catch(() => setContracts([]));
    getHistory().then(setAnalyses).catch(() => setAnalyses([]));
  }, []);

  const latest = analyses[0] ?? null;
  const fraudCount = analyses.reduce((sum, item) => sum + item.fraudWarnings.length, 0);
  const avgConfidence = useMemo(() => {
    const clauses = analyses.flatMap((item) => item.clauses);
    if (!clauses.length) return 0;
    return Math.round(clauses.reduce((sum, clause) => sum + clause.confidence, 0) / clauses.length);
  }, [analyses]);

  const selectContract = (fileId: string) => {
    window.localStorage.setItem('contract_guardian_last_contract', fileId);
    const match = analyses.find((a) => a.contractId === fileId);
    if (match) {
      window.localStorage.setItem('contract_guardian_last_analysis', JSON.stringify(match));
    }
    navigate('/analysis');
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Command Center"
        title="Contract Risk Dashboard"
        description="Real-time legal intelligence across uploaded contracts, active AI audits, fraud signals, and risk distributions."
        action={
          <Link
            to="/upload"
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-legal-teal px-4 py-2.5 text-sm font-semibold text-ink hover:bg-legal-teal/90 transition"
          >
            <UploadCloud size={17} />
            Upload Contract
          </Link>
        }
      />

      {/* Top Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<FileSearch size={22} />}
          label="Uploaded Contracts"
          value={String(contracts.length)}
          trend="Active in repository"
        />
        <Metric
          icon={<AlertTriangle size={22} />}
          label="Fraud Alerts"
          value={String(fraudCount)}
          trend="Suspicious terms detected"
          danger={fraudCount > 0}
        />
        <Metric
          icon={<ShieldCheck size={22} />}
          label="Avg AI Confidence"
          value={`${avgConfidence}%`}
          trend="Across analyzed clauses"
        />
        <Metric
          icon={<ArrowUpRight size={22} />}
          label="Protected Endpoints"
          value="4"
          trend="Automated compliance"
        />
      </div>

      {/* Gauges and Distribution */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <GlassCard className="p-6">
          <RiskMeter score={latest?.contractRiskScore ?? 0} />
          {latest && (
            <div className="mt-3 text-center text-xs text-slate-400">
              Latest Analyzed: <span className="text-white font-medium">{latest.contractId?.slice(0, 8)}...</span>
            </div>
          )}
        </GlassCard>
        <GlassCard className="p-6">
          <DonutChart title="Portfolio Risk Distribution" values={riskDistribution(analyses)} />
        </GlassCard>
      </div>

      {/* Recent Files & Fraud Signals */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        {/* Recent Files */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Contracts</h2>
            <Link to="/history" className="text-xs text-legal-teal hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {contracts.length === 0 && <p className="text-xs text-slate-400 py-3">No contracts uploaded yet.</p>}
            {contracts.slice(0, 5).map((file) => (
              <div
                key={file.id}
                onClick={() => selectContract(file.id)}
                className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white group-hover:text-legal-teal transition">
                      {file.originalFilename}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {file.fileType} · {fileSize(file.fileSizeBytes)} · {prettyDate(file.createdAt)}
                    </p>
                  </div>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
                    {normalizeStatus(file.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Top Fraud Signals */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Top Fraud & Trap Signals</h2>
            <span className="text-xs text-legal-red font-medium">{fraudCount} total</span>
          </div>
          <div className="space-y-2.5">
            {analyses
              .flatMap((item) => item.fraudWarnings)
              .slice(0, 4)
              .map((alert, index) => (
                <div key={`${alert.type}-${index}`} className="rounded-lg border border-legal-red/20 bg-legal-red/5 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-white">{alert.type.replace(/_/g, ' ')}</p>
                    <RiskBadge level={normalizeRisk(alert.severity)} />
                  </div>
                  <p className="text-xs leading-5 text-slate-400 line-clamp-2">{alert.whySuspicious}</p>
                </div>
              ))}
            {fraudCount === 0 && (
              <p className="text-xs text-slate-400 py-3">No fraud signals detected across audited contracts.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Confidence & Interactive Risk Timeline */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6">
          <ConfidenceGauge value={avgConfidence} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Historical Risk Score Timeline</h2>
            <span className="text-xs text-slate-400">Past audits</span>
          </div>
          <div className="flex h-32 items-end gap-2.5 pt-4">
            {(analyses.length ? analyses : [{ contractRiskScore: 0 } as Analysis]).slice(0, 8).map((analysis, index) => {
              const score = analysis.contractRiskScore;
              const barColor =
                score >= 80 ? 'bg-legal-red' : score >= 50 ? 'bg-legal-amber' : score >= 25 ? 'bg-yellow-300' : 'bg-legal-green';

              return (
                <div
                  key={index}
                  onClick={() => analysis.contractId && selectContract(analysis.contractId)}
                  className="group relative flex flex-1 flex-col items-center gap-1.5 cursor-pointer"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-8 hidden group-hover:flex flex-col items-center z-10">
                    <span className="rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap border border-white/10 shadow-lg">
                      {score}/100
                    </span>
                  </div>

                  <div className="w-full rounded-t-md bg-white/10 h-24 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-md transition-all group-hover:brightness-125 ${barColor}`}
                      style={{ height: `${Math.max(8, score)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-white transition">
                    #{index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  trend,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  trend: string;
  danger?: boolean;
}) {
  return (
    <GlassCard className="p-5">
      <div
        className={`mb-4 grid h-10 w-10 place-items-center rounded-lg ${
          danger ? 'bg-legal-red/15 text-legal-red' : 'bg-legal-teal/15 text-legal-teal'
        }`}
      >
        {icon}
      </div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{trend}</p>
    </GlassCard>
  );
}

function riskDistribution(analyses: Analysis[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  analyses.forEach((item) => {
    counts[normalizeRisk(item.riskLevel)] += 1;
  });
  return [
    { label: 'Critical', value: counts.critical, color: '#ff5f6d' },
    { label: 'High', value: counts.high, color: '#ffb454' },
    { label: 'Medium', value: counts.medium, color: '#fde047' },
    { label: 'Low', value: counts.low, color: '#48d597' },
  ];
}
