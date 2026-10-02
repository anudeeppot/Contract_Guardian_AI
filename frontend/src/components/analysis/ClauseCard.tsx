import { useState } from 'react';
import { Check, ChevronDown, Copy, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Clause } from '../../types';
import { riskColor } from '../../utils/format';
import { RiskBadge } from '../ui/RiskBadge';
import { rewriteClause } from '../../api/analysis';
import { showToast } from '../ui/Toast';

export function ClauseCard({ clause }: { clause: Clause }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  // AI Rewrite Sandbox State
  const [showSandbox, setShowSandbox] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [activeAlternative, setActiveAlternative] = useState(clause.saferAlternative);
  const [rewriteReasoning, setRewriteReasoning] = useState<string | null>(null);

  async function copyAlternative(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast('Safer clause copied to clipboard', 'success');
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function copyOriginal() {
    await navigator.clipboard.writeText(clause.text);
    setCopiedOriginal(true);
    showToast('Original clause copied to clipboard', 'info');
    window.setTimeout(() => setCopiedOriginal(false), 1400);
  }

  async function handleAIGenerate() {
    setIsRewriting(true);
    try {
      const toneMap = {
        conservative: 'Draft a conservative clause strictly protecting against exposure, requiring mutual written consent.',
        balanced: 'Draft a balanced, market-standard commercial clause fair to both parties.',
        aggressive: 'Draft an aggressive clause heavily favoring our side with unilateral termination and no liability.',
      };

      const contextPrompt = `${toneMap[selectedTone]}${
        customInstructions.trim() ? ` Additional requirement: ${customInstructions.trim()}` : ''
      }`;

      const res = await rewriteClause(clause.text, contextPrompt);
      if (res.saferAlternative) {
        setActiveAlternative(res.saferAlternative);
        setRewriteReasoning(res.reasoning);
        showToast('AI alternative generated successfully', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rewrite request failed', 'error');
    } finally {
      setIsRewriting(false);
    }
  }

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20">
      <div className="flex w-full items-start justify-between gap-3 text-left">
        <div className="cursor-pointer flex-1" onClick={() => setOpen((value) => !value)}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Clause {clause.clauseIndex}</span>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {clause.clauseType}
            </span>
          </div>
          <span className="mt-1 block text-base font-semibold text-white hover:text-legal-teal transition">
            {clause.heading}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <RiskBadge level={clause.riskLevel} />
          <button
            onClick={() => setOpen((value) => !value)}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <ChevronDown className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Original Clause */}
                <div className="flex flex-col justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Original Clause
                      </p>
                      <button
                        onClick={copyOriginal}
                        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200 transition"
                      >
                        {copiedOriginal ? <Check size={13} className="text-legal-green" /> : <Copy size={13} />}
                        {copiedOriginal ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className={`rounded-lg border p-3.5 text-sm leading-6 ${riskColor[clause.riskLevel]}`}>
                      {clause.text}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {clause.riskReasons.map((reason) => (
                        <span key={reason} className="rounded-md bg-white/8 px-2 py-0.5 text-xs text-slate-300">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                  {clause.legalReasoning && (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-legal-gold">
                        Legal Rationale
                      </span>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{clause.legalReasoning}</p>
                    </div>
                  )}
                </div>

                {/* Suggested Alternative */}
                <div className="flex flex-col justify-between rounded-lg border border-legal-green/20 bg-legal-green/[0.03] p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-legal-green">
                          Safer Alternative
                        </p>
                        <span className="rounded-full bg-legal-teal/15 px-2 py-0.5 text-[10px] font-medium text-legal-teal">
                          {clause.confidence}% Confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowSandbox((v) => !v)}
                          className="focus-ring inline-flex items-center gap-1 rounded bg-legal-teal/15 px-2.5 py-1 text-xs font-medium text-legal-teal hover:bg-legal-teal/25 transition"
                        >
                          <Sparkles size={13} />
                          {showSandbox ? 'Hide Sandbox' : 'AI Rewrite'}
                        </button>
                        <button
                          onClick={() => copyAlternative(activeAlternative)}
                          className="focus-ring inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/15 transition"
                        >
                          {copied ? <Check size={13} className="text-legal-green" /> : <Copy size={13} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <p className="rounded-lg border border-legal-green/30 bg-legal-green/10 p-3.5 text-sm leading-6 text-slate-100 font-sans">
                      {activeAlternative}
                    </p>
                  </div>
                  {clause.businessImpact && (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-legal-teal">
                        Business Impact
                      </span>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{clause.businessImpact}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Rewrite Assistant Drawer */}
              <AnimatePresence>
                {showSandbox && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 rounded-lg border border-legal-teal/30 bg-[#0d1f2d]/90 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 size={16} className="text-legal-teal" />
                      <span className="text-sm font-semibold text-white">AI Clause Customization Sandbox</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] items-end">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Negotiation Tone</label>
                        <div className="flex gap-1.5">
                          {(['conservative', 'balanced', 'aggressive'] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => setSelectedTone(tone)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                                selectedTone === tone
                                  ? 'bg-legal-teal text-ink font-semibold'
                                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Custom Clause Instructions</label>
                        <input
                          type="text"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          placeholder="e.g., Cap damages to $10,000; require 60 days notice..."
                          className="focus-ring w-full rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
                        />
                      </div>

                      <button
                        onClick={handleAIGenerate}
                        disabled={isRewriting}
                        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-md bg-legal-teal px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50 transition"
                      >
                        <RefreshCw size={13} className={isRewriting ? 'animate-spin' : ''} />
                        {isRewriting ? 'Rewriting...' : 'Regenerate'}
                      </button>
                    </div>

                    {rewriteReasoning && (
                      <div className="mt-3 rounded border border-legal-teal/20 bg-legal-teal/10 p-2.5 text-xs text-slate-300">
                        <span className="font-semibold text-legal-teal">AI Reasoning: </span>
                        {rewriteReasoning}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
