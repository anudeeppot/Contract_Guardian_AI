import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  DollarSign,
  FileSignature,
  FileText,
  Filter,
  Landmark,
  Search,
  TimerReset,
  Download,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLatestAnalysis } from '../api/analysis';
import { ClauseCard } from '../components/analysis/ClauseCard';
import { FraudAlertCard } from '../components/analysis/FraudAlertCard';
import { DocumentViewerModal } from '../components/analysis/DocumentViewerModal';
import { ConfidenceGauge, DonutChart, RiskMeter } from '../components/charts/Charts';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskBadge } from '../components/ui/RiskBadge';
import type { Analysis, Clause, FraudAlert, RiskLevel } from '../types';
import { normalizeRisk } from '../utils/format';

export function AnalysisPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(() => {
    const cached = window.localStorage.getItem('contract_guardian_last_analysis');
    return cached ? JSON.parse(cached) : null;
  });
  const [error, setError] = useState('');
  const [contractId, setContractId] = useState<string | null>(() => {
    return window.localStorage.getItem('contract_guardian_last_contract');
  });

  // Clause Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | RiskLevel>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [showDocModal, setShowDocModal] = useState(false);

  useEffect(() => {
    const storedContractId = window.localStorage.getItem('contract_guardian_last_contract');
    if (!storedContractId) return;
    setContractId(storedContractId);
    getLatestAnalysis(storedContractId)
      .then((data) => {
        setAnalysis(data);
        window.localStorage.setItem('contract_guardian_last_analysis', JSON.stringify(data));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load analysis'));
  }, []);

  const clauses = useMemo(() => normalizeClauses(analysis), [analysis]);
  const alerts = useMemo(() => normalizeFraudAlerts(analysis), [analysis]);
  const summaryItems = useMemo(() => buildSummaryItems(analysis), [analysis]);
  const averageConfidence = clauses.length
    ? Math.round(clauses.reduce((sum, item) => sum + item.confidence, 0) / clauses.length)
    : 0;

  // Clause Types for Category Filter
  const clauseTypes = useMemo(() => {
    const types = new Set(clauses.map((c) => c.clauseType).filter(Boolean));
    return ['all', ...Array.from(types)];
  }, [clauses]);

  // Risk Counts for Badges
  const riskCounts = useMemo(() => {
    const counts = { all: clauses.length, critical: 0, high: 0, medium: 0, low: 0 };
    clauses.forEach((c) => {
      counts[c.riskLevel] += 1;
    });
    return counts;
  }, [clauses]);

  // Filtered Clauses
  const filteredClauses = useMemo(() => {
    return clauses.filter((c) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        c.heading.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.riskReasons.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.clauseType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk = selectedRiskFilter === 'all' || c.riskLevel === selectedRiskFilter;
      const matchesType = selectedTypeFilter === 'all' || c.clauseType === selectedTypeFilter;

      return matchesSearch && matchesRisk && matchesType;
    });
  }, [clauses, searchQuery, selectedRiskFilter, selectedTypeFilter]);

  if (!analysis) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="AI review"
          title="No analysis loaded"
          description="Upload and analyze a contract to see live AI results here."
        />
        {error && <GlassCard className="p-5 text-legal-red">{error}</GlassCard>}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="AI Legal Intelligence"
        title="Contract Risk Audit"
        description="Clause-level risk intelligence, fraud signals, business impact, safer alternatives, and confidence scoring."
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDocModal(true)}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              <FileText size={16} className="text-legal-teal" />
              View Full Contract Text
            </button>
            <Link
              to="/report"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-legal-teal px-4 py-2.5 text-sm font-semibold text-ink hover:bg-legal-teal/90 transition"
            >
              <Download size={16} />
              Export Report
            </Link>
          </div>
        }
      />

      {/* Top Overview: Risk Meter & Summary */}
      <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <GlassCard className="p-6">
          <RiskMeter score={analysis.contractRiskScore} />
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
            <span>Status: <span className="text-white font-medium capitalize">{analysis.status ?? 'completed'}</span></span>
            <span>Total Clauses: <span className="text-white font-medium">{clauses.length}</span></span>
            <span>Fraud Warnings: <span className="text-legal-red font-medium">{alerts.length}</span></span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Executive Legal Summary</h2>
              <span className="rounded bg-legal-teal/10 px-2.5 py-1 text-xs font-semibold text-legal-teal">
                AI Synthesized
              </span>
            </div>
            <p className="text-sm leading-7 text-slate-300">
              {analysis.summary?.executiveSummary || 'No executive summary available.'}
            </p>
          </div>
          {analysis.summary?.partiesInvolved?.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Identified Parties: </span>
              {analysis.summary.partiesInvolved.join(', ')}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Fraud Signals Section */}
      {alerts.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="text-legal-red" size={20} />
              Detected Fraud Warnings & Traps ({alerts.length})
            </h2>
          </div>
          <div className="grid gap-4">
            {alerts.map((alert) => (
              <FraudAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* Summary Breakdown & Charts */}
      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <GlassCard className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Plain English Deal Points</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
                <div className="mb-2 flex items-center gap-2 text-legal-gold">
                  <item.icon size={16} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">{item.label}</p>
                </div>
                <p className="text-sm leading-6 text-slate-300 line-clamp-3">{item.value || 'Not specified'}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col justify-between">
          <DonutChart title="Clause Risk Breakdown" values={riskBreakdown(clauses)} />
          <div className="mt-6 border-t border-white/10 pt-4">
            <ConfidenceGauge value={averageConfidence} />
          </div>
        </GlassCard>
      </section>

      {/* Key Findings / Important Points */}
      {analysis.importantPoints?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Critical Deal Highlights</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.importantPoints.map((item) => (
              <div
                key={`${item.category}-${item.text}`}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20"
              >
                <div className="mb-3">
                  <RiskBadge level={normalizeRisk(item.importance)} />
                </div>
                <p className="font-semibold text-white text-sm">{item.category.replace(/_/g, ' ')}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Clause Viewer & Suggested Alternatives with Filter Power Bar */}
      <section className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Clause Analysis & Safer Alternatives</h2>
            <p className="text-xs text-slate-400">
              Showing {filteredClauses.length} of {clauses.length} clauses
            </p>
          </div>
        </div>

        {/* Filter Power Bar */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clauses, keywords, terms..."
                className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500"
              />
            </div>

            {/* Severity Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={13} /> Severity:
              </span>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedRiskFilter(lvl)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                    selectedRiskFilter === lvl
                      ? 'bg-legal-teal text-ink font-semibold'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {lvl} ({riskCounts[lvl]})
                </button>
              ))}
            </div>

            {/* Clause Type Filter */}
            {clauseTypes.length > 2 && (
              <div className="w-full md:w-auto">
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="focus-ring w-full rounded-lg border border-white/10 bg-panel px-3 py-1.5 text-xs text-white"
                >
                  {clauseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All Clause Types' : type}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Clauses List */}
        <div className="space-y-3">
          {filteredClauses.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-slate-400">
              No clauses found matching your filter criteria. Try clearing the search query or selecting "all".
            </GlassCard>
          ) : (
            filteredClauses.map((clause) => <ClauseCard key={clause.id} clause={clause} />)
          )}
        </div>
      </section>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        contractId={contractId}
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title={analysis.summary?.partiesInvolved?.join(' & ') || 'Contract Document'}
      />
    </div>
  );
}

function normalizeClauses(analysis: Analysis | null): Clause[] {
  return (analysis?.clauses ?? []).map((clause, index) => ({
    ...clause,
    id: `${index}`,
    clauseIndex: index + 1,
    heading: clause.title ?? clause.heading ?? `Clause ${index + 1}`,
    clauseType: clause.clauseType ?? 'General',
    riskLevel: normalizeRisk(clause.risk ?? clause.riskLevel),
    riskReasons: clause.riskReasons?.length ? clause.riskReasons : [clause.reason ?? 'Potential risk detected'],
    legalReasoning: clause.legalReasoning ?? '',
    businessImpact: clause.businessImpact ?? '',
    saferAlternative: clause.saferAlternative ?? '',
    flags: clause.flags ?? [],
  }));
}

function normalizeFraudAlerts(analysis: Analysis | null): FraudAlert[] {
  return (analysis?.fraudWarnings ?? []).map((warning, index) => ({
    id: `${index}`,
    title: warning.type.replace(/_/g, ' '),
    risk_level: normalizeRisk(warning.severity),
    why_detected: warning.whySuspicious,
    business_impact: warning.text,
    recommended_action: 'Review this wording with counsel before signing.',
  }));
}

function buildSummaryItems(analysis: Analysis | null) {
  const summary = analysis?.summary;
  return [
    { label: 'Purpose', value: summary?.purpose, icon: FileSignature },
    { label: 'Duration', value: summary?.duration, icon: TimerReset },
    { label: 'Parties Involved', value: summary?.partiesInvolved?.join(', '), icon: ClipboardList },
    { label: 'Financial Obligations', value: summary?.financialObligations?.join(' '), icon: DollarSign },
    { label: 'Termination', value: summary?.terminationConditions?.join(' '), icon: AlertTriangle },
    { label: 'Renewal', value: summary?.renewal, icon: CalendarClock },
    { label: 'Important Dates', value: summary?.importantDates?.join(', '), icon: Landmark },
  ];
}

function riskBreakdown(clauses: Clause[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  clauses.forEach((clause) => {
    counts[clause.riskLevel] += 1;
  });
  return [
    { label: 'Critical', value: counts.critical, color: '#ff5f6d' },
    { label: 'High', value: counts.high, color: '#ffb454' },
    { label: 'Medium', value: counts.medium, color: '#fde047' },
    { label: 'Low', value: counts.low, color: '#48d597' },
  ];
}
