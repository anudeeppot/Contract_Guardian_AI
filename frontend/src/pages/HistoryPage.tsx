import {
  ArrowRight,
  CheckSquare,
  GitCompareArrows,
  Search,
  Square,
  Trash2,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listContracts, deleteContract } from '../api/contracts';
import { getHistory } from '../api/analysis';
import type { Analysis, ContractFile, RiskLevel } from '../types';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskBadge } from '../components/ui/RiskBadge';
import { showToast } from '../components/ui/Toast';
import { fileSize, normalizeRisk, normalizeStatus, prettyDate } from '../utils/format';

export function HistoryPage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractFile[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [query, setQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    listContracts().then(setContracts).catch(() => setContracts([]));
    getHistory().then(setAnalyses).catch(() => setAnalyses([]));
  }

  // Create contract-to-analysis map for quick lookup
  const analysisMap = useMemo(() => {
    const map = new Map<string, Analysis>();
    analyses.forEach((a) => {
      if (a.contractId) {
        map.set(a.contractId, a);
      }
    });
    return map;
  }, [analyses]);

  // Filter rows by search and risk level
  const rows = useMemo(() => {
    return contracts.filter((file, index) => {
      const matchesSearch = file.originalFilename.toLowerCase().includes(query.toLowerCase());
      const analysis = analysisMap.get(file.id) || analyses[index];
      const risk = analysis ? normalizeRisk(analysis.riskLevel) : 'unclassified';
      const matchesRisk = selectedRisk === 'all' || risk === selectedRisk;
      return matchesSearch && matchesRisk;
    });
  }, [contracts, query, selectedRisk, analysisMap, analyses]);

  // Selection for comparison
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 2) {
        // Replace second selection
        return [prev[0], id];
      }
      return [...prev, id];
    });
  };

  // Delete handler
  async function handleDelete(fileId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this contract and its risk analysis?')) {
      return;
    }
    setDeletingId(fileId);
    try {
      await deleteContract(fileId);
      setContracts((prev) => prev.filter((c) => c.id !== fileId));
      setSelectedIds((prev) => prev.filter((id) => id !== fileId));
      showToast('Contract deleted successfully', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete contract', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // Row navigation to analysis
  function openAnalysis(fileId: string) {
    window.localStorage.setItem('contract_guardian_last_contract', fileId);
    const analysis = analysisMap.get(fileId);
    if (analysis) {
      window.localStorage.setItem('contract_guardian_last_analysis', JSON.stringify(analysis));
    }
    navigate('/analysis');
  }

  // Get selected objects for compare modal
  const compareItems = useMemo(() => {
    return selectedIds.map((id) => {
      const contract = contracts.find((c) => c.id === id);
      const analysis = analysisMap.get(id);
      return { contract, analysis };
    });
  }, [selectedIds, contracts, analysisMap]);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Contract Archive"
        title="Audit History & Comparison"
        description="Search past risk evaluations, compare versions side-by-side, and manage contract records."
      />

      <GlassCard className="p-6">
        {/* Search, Filter & Compare Bar */}
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-500"
              placeholder="Search contracts by name..."
            />
          </div>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-panel px-3 py-2.5 text-xs text-white"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>

          <button
            onClick={() => setShowCompareModal(true)}
            disabled={selectedIds.length !== 2}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-legal-teal px-4 py-2.5 text-xs font-semibold text-ink disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <GitCompareArrows size={16} />
            Compare Selected ({selectedIds.length}/2)
          </button>
        </div>

        {/* Selected Counter Notification */}
        {selectedIds.length > 0 && selectedIds.length < 2 && (
          <div className="mb-4 rounded-lg bg-legal-teal/10 border border-legal-teal/20 px-4 py-2.5 text-xs text-legal-teal flex items-center justify-between">
            <span>Select 1 more contract to compare side-by-side.</span>
            <button onClick={() => setSelectedIds([])} className="underline text-slate-300 hover:text-white">
              Clear selection
            </button>
          </div>
        )}

        {/* Table Rows */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              No contracts found matching your filters.
            </p>
          ) : (
            rows.map((file, index) => {
              const analysis = analysisMap.get(file.id) || analyses[index];
              const isSelected = selectedIds.includes(file.id);

              return (
                <div
                  key={file.id}
                  onClick={() => openAnalysis(file.id)}
                  className={`grid cursor-pointer gap-3 border-b border-white/10 p-4 transition last:border-0 md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center hover:bg-white/[0.06] ${
                    isSelected ? 'bg-legal-teal/[0.07]' : 'bg-white/[0.02]'
                  }`}
                >
                  {/* Checkbox for comparison */}
                  <div
                    onClick={(e) => toggleSelect(file.id, e)}
                    className="text-slate-400 hover:text-legal-teal transition p-1"
                    title="Select to compare"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-legal-teal" />
                    ) : (
                      <Square size={18} />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white hover:text-legal-teal transition">
                      {file.originalFilename}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {file.fileType} · {fileSize(file.fileSizeBytes)} · Uploaded {prettyDate(file.createdAt)}
                    </p>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-slate-400">{prettyDate(file.createdAt)}</p>

                  {/* Risk Badge or Status */}
                  <div>
                    {analysis ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{analysis.contractRiskScore}/100</span>
                        <RiskBadge level={normalizeRisk(analysis.riskLevel)} />
                      </div>
                    ) : (
                      <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs capitalize text-slate-300">
                        {normalizeStatus(file.status)}
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(file.id, e)}
                    disabled={deletingId === file.id}
                    className="focus-ring rounded-lg bg-legal-red/10 p-2 text-legal-red hover:bg-legal-red/20 transition"
                    title="Delete contract"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {/* Contract Comparison Modal */}
      {showCompareModal && compareItems.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-legal-teal/15 text-legal-teal">
                  <GitCompareArrows size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Contract Comparison Matrix</h3>
                  <p className="text-xs text-slate-400">Comparing deal risk, terms, and fraud exposure</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5">
              {/* Header Titles */}
              <div className="grid grid-cols-2 gap-4">
                {compareItems.map((item, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-legal-teal">
                      Contract {i + 1}
                    </span>
                    <p className="font-semibold text-white text-sm truncate mt-1">
                      {item.contract?.originalFilename || 'Unknown Contract'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.contract?.fileType} · {prettyDate(item.contract?.createdAt || '')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Metric 1: Overall Risk Score */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  Overall Risk Score Comparison
                </span>
                <div className="grid grid-cols-2 gap-4 items-center">
                  {compareItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-white">
                        {item.analysis?.contractRiskScore ?? 0}
                      </span>
                      {item.analysis && (
                        <RiskBadge level={normalizeRisk(item.analysis.riskLevel)} />
                      )}
                    </div>
                  ))}
                </div>
                {compareItems[0].analysis && compareItems[1].analysis && (
                  <div className="mt-3 text-xs text-legal-teal border-t border-white/5 pt-2">
                    Score Difference: {Math.abs(
                      compareItems[0].analysis.contractRiskScore - compareItems[1].analysis.contractRiskScore
                    )} points
                  </div>
                )}
              </div>

              {/* Metric 2: Fraud Alert Warnings */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  Fraud & Scam Alerts
                </span>
                <div className="grid grid-cols-2 gap-4">
                  {compareItems.map((item, i) => (
                    <div key={i}>
                      <span className="text-sm font-semibold text-white">
                        {item.analysis?.fraudWarnings?.length ?? 0} warnings detected
                      </span>
                      <div className="mt-2 space-y-1.5">
                        {item.analysis?.fraudWarnings?.map((w, idx) => (
                          <div key={idx} className="rounded bg-legal-red/10 border border-legal-red/20 px-2.5 py-1 text-xs text-legal-red flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            <span className="truncate">{w.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metric 3: Total Clauses */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  Clauses Identified
                </span>
                <div className="grid grid-cols-2 gap-4">
                  {compareItems.map((item, i) => (
                    <div key={i} className="text-sm font-semibold text-white">
                      {item.analysis?.clauses?.length ?? 0} clauses
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCompareModal(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
