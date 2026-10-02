import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileCode,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { extractText, listContracts, uploadContract } from '../api/contracts';
import { startAnalysis } from '../api/analysis';
import { useDropzone } from '../hooks/useDropzone';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { showToast } from '../components/ui/Toast';
import { fileSize, normalizeStatus, prettyDate } from '../utils/format';
import type { ContractFile } from '../types';

interface DemoPreset {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  filename: string;
  content: string;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'saas_normal',
    title: 'Standard SaaS Agreement',
    badge: 'Low Risk',
    badgeColor: 'text-legal-green border-legal-green/30 bg-legal-green/10',
    description: 'Mutual confidentiality, standard SLA, 30-day termination, capped liability at 12 months fees.',
    filename: 'saas_service_agreement.txt',
    content: `SOFTWARE-AS-A-SERVICE AGREEMENT
This Agreement is entered into by CloudHost Tech Inc. ("Provider") and Client Corp ("Customer").

1. Services & SLA
Provider shall provide 99.9% platform availability. Planned maintenance shall require 7 days advance notice.

2. Fees & Invoicing
Fees are billed annually. Invoices are payable net 30 days. Disputed charges may be withheld in good faith.

3. Term & Termination
Term is 12 months. Either party may terminate with 30 days written notice prior to renewal, or immediately upon material breach.

4. Limitation of Liability
Each party's aggregate liability under this agreement shall be limited to the total fees paid in the preceding 12 months.

5. Confidentiality & IP
Each party retains ownership of its pre-existing IP and confidential information. Obligations survive 3 years.

6. Governing Law
This Agreement shall be governed by the laws of the State of Delaware.`,
  },
  {
    id: 'vendor_risky',
    title: 'Vendor Services Agreement',
    badge: 'High Risk',
    badgeColor: 'text-legal-amber border-legal-amber/30 bg-legal-amber/10',
    description: 'Hidden fees, automatic renewal with narrow notice window, one-sided uncapped liability, IP assignment.',
    filename: 'vendor_master_agreement.txt',
    content: `MASTER SERVICES AGREEMENT
Between Acme Retail Inc. and VendorMax Solutions LLC.

1. Services
VendorMax provides managed software platform services.

2. Payment & Administrative Fees
Customer shall pay all invoices within 10 days. Vendor may add administrative fees, processing fees, or other charges at its sole discretion without prior notice. Late payments shall trigger a penalty of 75% of the unpaid amount.

3. Term and Automatic Renewal
Agreement begins January 1, 2026 and automatically renews for successive one-year terms unless Customer gives written notice exactly 15 days before expiration.

4. Uncapped Liability
Customer shall be liable for all direct, indirect, incidental, special, and consequential damages without limitation. Vendor liability is capped at $1.00.

5. Intellectual Property Assignment
Customer assigns all intellectual property, work product, feedback, ideas, data, and improvements to Vendor in perpetuity.

6. Termination
Customer may not terminate this agreement for convenience. Vendor may terminate immediately for any reason.`,
  },
  {
    id: 'scam_critical',
    title: 'High-Yield Investment Agreement',
    badge: 'Critical / Scam',
    badgeColor: 'text-legal-red border-legal-red/30 bg-legal-red/10',
    description: 'Guaranteed 500% returns, unilateral dispute resolution abroad, blank exhibits, waiver of legal recourse.',
    filename: 'investment_opportunity_agreement.txt',
    content: `SECURE GUARANTEED CAPITAL AGREEMENT
Between Global Wealth Growth Consortium and Participant.

1. Capital Contribution & Guaranteed Return
Participant contributes $25,000. Consortium guarantees an unconditional 500% return payable within 60 days.

2. Fund Transfer & Non-Refundability
All transferred funds are immediately non-refundable and converted into proprietary offshore yield instruments.

3. Waiver of Legal Recourse
Participant explicitly waives all rights to file civil suits, class actions, regulatory complaints, or arbitration.

4. Dispute Resolution
Any dispute shall be heard exclusively by an arbitral board appointed solely by the Consortium in a non-extradition jurisdiction.

5. Blank Reference Schedule
Participant agrees to bind themselves to Schedule [_____] containing subsequent fee assessments to be determined later.`,
  },
];

const PIPELINE_STAGES = [
  { id: 1, label: 'Document Intake', desc: 'Validating file format and computing hash' },
  { id: 2, label: 'Text Extraction', desc: 'Extracting clauses, paragraphs, and structure' },
  { id: 3, label: 'AI Risk & Fraud Audit', desc: 'Executing LangChain analysis and scoring' },
  { id: 4, label: 'Deal Intelligence Report', desc: 'Generating safer alternatives and summary' },
];

export function UploadPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [contracts, setContracts] = useState<ContractFile[]>([]);
  const [activeStage, setActiveStage] = useState<number>(0); // 0 = idle, 1..4
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listContracts().then(setContracts).catch(() => setContracts([]));
  }, []);

  const onFiles = useCallback((files: File[]) => {
    const file = files.find((item) => /\.(pdf|docx|txt)$/i.test(item.name));
    if (!file) {
      setError('Please choose a PDF, DOCX, or TXT contract.');
      return;
    }
    setSelected(file);
    setProgress(0);
    setError('');
    setActiveStage(0);
  }, []);

  async function processContractFile(fileToProcess: File) {
    setBusy(true);
    setError('');
    setActiveStage(1);

    try {
      // Step 1: Upload
      const contract = await uploadContract(fileToProcess, setProgress);
      setContracts((items) => [contract, ...items]);
      window.localStorage.setItem('contract_guardian_last_contract', contract.id);

      // Step 2: Extract Text
      setActiveStage(2);
      await extractText(contract.id);

      // Step 3: Start AI Analysis
      setActiveStage(3);
      const analysis = await startAnalysis(contract.id);
      window.localStorage.setItem('contract_guardian_last_analysis', JSON.stringify(analysis));

      // Step 4: Finalize
      setActiveStage(4);
      showToast('Contract analysis completed successfully!', 'success');

      setTimeout(() => {
        navigate('/analysis');
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload or analysis failed');
      setActiveStage(0);
      showToast('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function handleSelectPreset(preset: DemoPreset) {
    const file = new File([preset.content], preset.filename, { type: 'text/plain' });
    setSelected(file);
    processContractFile(file);
  }

  const dropzone = useDropzone(onFiles);
  const { isDragging, ...dropzoneProps } = dropzone;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Document Intake"
        title="Upload & Analyze Contract"
        description="Drop a contract to trigger automated AI risk classification, scam signal detection, and safer clause generation."
      />

      {/* 1-Click Demo Presets */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={17} className="text-legal-teal" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            1-Click Demo Test Contracts
          </h2>
          <span className="text-xs text-slate-400 font-normal">
            (No file required — click any to test instant AI analysis)
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_PRESETS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => !busy && handleSelectPreset(preset)}
              className={`group cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-legal-teal/50 hover:bg-white/[0.06] ${
                busy ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white group-hover:text-legal-teal transition">
                  {preset.title}
                </span>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${preset.badgeColor}`}>
                  {preset.badge}
                </span>
              </div>
              <p className="text-xs leading-5 text-slate-400 line-clamp-2">{preset.description}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-legal-teal group-hover:translate-x-0.5 transition">
                <Sparkles size={13} />
                <span>Launch Analysis</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Upload Area & Pipeline Stepper */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <GlassCard className="p-6">
          <div
            {...dropzoneProps}
            className={`grid min-h-[260px] cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? 'border-legal-teal bg-legal-teal/10'
                : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-legal-teal/15 text-legal-teal">
                <UploadCloud size={28} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">Drop contract file here</h2>
              <p className="mt-1.5 text-xs text-slate-400">PDF, DOCX, or TXT up to 25MB</p>
              <input
                className="hidden"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
              />
            </div>
          </div>

          {/* Selected File Card */}
          {selected && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-legal-gold/15 text-legal-gold">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{selected.name}</p>
                    <p className="text-xs text-slate-500">{fileSize(selected.size)}</p>
                  </div>
                </div>
                {!busy && (
                  <button
                    className="focus-ring rounded-lg bg-white/5 p-1.5 text-slate-400 hover:text-white"
                    onClick={() => setSelected(null)}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {progress > 0 && progress < 100 && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-legal-teal transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-lg border border-legal-red/30 bg-legal-red/10 p-3 text-xs text-legal-red">
                  {error}
                </p>
              )}

              {!busy && (
                <button
                  onClick={() => processContractFile(selected)}
                  className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-legal-teal px-4 py-3 font-semibold text-ink hover:bg-legal-teal/90 transition"
                >
                  <ShieldCheck size={18} />
                  Upload & Launch AI Audit
                </button>
              )}
            </div>
          )}

          {/* Multi-Step Pipeline Stepper */}
          {busy && (
            <div className="mt-5 rounded-xl border border-legal-teal/30 bg-[#0c1a27]/80 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-legal-teal">
                  AI Pipeline in Progress
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Loader2 size={13} className="animate-spin text-legal-teal" />
                  Stage {activeStage} of 4
                </span>
              </div>

              <div className="space-y-3">
                {PIPELINE_STAGES.map((stage) => {
                  const isDone = activeStage > stage.id;
                  const isCurrent = activeStage === stage.id;

                  return (
                    <div
                      key={stage.id}
                      className={`flex items-start gap-3 rounded-lg p-2.5 transition ${
                        isCurrent
                          ? 'bg-white/10 border border-legal-teal/40'
                          : isDone
                          ? 'bg-white/[0.02]'
                          : 'opacity-40'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-legal-green" />
                        ) : isCurrent ? (
                          <Loader2 size={16} className="animate-spin text-legal-teal" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                          {stage.label}
                        </p>
                        <p className="text-[11px] text-slate-400">{stage.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Recent Files Panel */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Documents</h2>
            <span className="text-xs text-slate-400">{contracts.length} loaded</span>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {contracts.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No uploaded contracts yet.</p>
            )}
            {contracts.map((file) => (
              <div
                key={file.id}
                onClick={() => {
                  window.localStorage.setItem('contract_guardian_last_contract', file.id);
                  navigate('/analysis');
                }}
                className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white group-hover:text-legal-teal transition">
                      {file.originalFilename}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {file.fileType} · {fileSize(file.fileSizeBytes)} · {prettyDate(file.createdAt)}
                    </p>
                  </div>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-legal-teal">
                    {normalizeStatus(file.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
