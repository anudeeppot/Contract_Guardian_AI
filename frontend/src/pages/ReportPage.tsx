import { Download, FileJson, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { downloadReport } from '../api/analysis';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskBadge } from '../components/ui/RiskBadge';
import type { Analysis } from '../types';
import { normalizeRisk } from '../utils/format';

export function ReportPage() {
  const [message, setMessage] = useState('');
  const analysis = useMemo<Analysis | null>(() => {
    const cached = window.localStorage.getItem('contract_guardian_last_analysis');
    return cached ? JSON.parse(cached) : null;
  }, []);

  async function save(format: 'json' | 'markdown' | 'pdf') {
    const analysisId = analysis?.analysisId ?? window.localStorage.getItem('contract_guardian_last_analysis_id');
    if (!analysisId) {
      setMessage('Analyze a contract first, then download the report.');
      return;
    }
    try {
      const blob = await downloadReport(analysisId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contract-analysis.${format === 'markdown' ? 'md' : format}`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Report downloaded.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Report"
        title="Executive risk report"
        description="Download, print, or export structured analysis outputs for review workflows."
        action={
          <div className="flex flex-wrap gap-2">
            <Action icon={<Download size={17} />} label="Download PDF" onClick={() => save('pdf')} />
            <Action icon={<FileJson size={17} />} label="Download JSON" onClick={() => save('json')} />
            <Action icon={<Printer size={17} />} label="Print" onClick={() => window.print()} />
          </div>
        }
      />
      {message && <GlassCard className="mb-4 p-4 text-sm text-legal-teal">{message}</GlassCard>}
      <GlassCard className="p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Latest analyzed contract</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Contract Guardian AI Report</h2>
          </div>
          {analysis && <RiskBadge level={normalizeRisk(analysis.riskLevel)} />}
        </div>
        {!analysis ? (
          <p className="mt-5 text-sm text-slate-400">No report is available yet. Upload and analyze a contract first.</p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm text-slate-400">Overall risk score</p>
              <p className="mt-2 text-6xl font-semibold text-white">{analysis.contractRiskScore}</p>
              <p className="mt-4 text-sm leading-6 text-slate-400">Automated contract analysis for informational purposes only. It is not legal advice.</p>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-semibold text-white">Summary</h3>
              <p className="text-sm leading-7 text-slate-300">{analysis.summary.executiveSummary}</p>
              <h3 className="mb-3 mt-6 text-lg font-semibold text-white">Key findings</h3>
              <div className="space-y-3">
                {analysis.importantPoints.slice(0, 5).map((finding) => (
                  <div key={`${finding.category}-${finding.text}`} className="rounded-lg bg-white/[0.04] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{finding.category.replace(/_/g, ' ')}</p>
                      <RiskBadge level={normalizeRisk(finding.importance)} />
                    </div>
                    <p className="text-sm leading-6 text-slate-400">{finding.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </GlassCard>
      {analysis && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-white">Fraud alerts</h3>
            <div className="space-y-3">{analysis.fraudWarnings.slice(0, 4).map((alert) => <p key={alert.type} className="rounded-lg bg-legal-red/10 p-3 text-sm text-slate-200">{alert.type}: {alert.whySuspicious}</p>)}</div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-white">Highest-risk clauses</h3>
            <div className="space-y-3">{analysis.clauses.slice(0, 2).map((clause, index) => <p key={index} className="rounded-lg bg-white/[0.04] p-3 text-sm text-slate-300">{clause.title ?? `Clause ${index + 1}`}: {clause.reason}</p>)}</div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return <button onClick={onClick} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium text-white hover:bg-white/12">{icon}{label}</button>;
}
