import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Check, FileText, Search, X } from 'lucide-react';
import { getContractText } from '../../api/contracts';
import { showToast } from '../ui/Toast';

interface DocumentViewerModalProps {
  contractId: string | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function DocumentViewerModal({
  contractId,
  isOpen,
  onClose,
  title = 'Full Contract Document',
}: DocumentViewerModalProps) {
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !contractId) return;
    setLoading(true);
    getContractText(contractId)
      .then((res) => {
        setText(res.text || 'No text extracted for this document.');
      })
      .catch(() => {
        setText('Could not load contract text.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, contractId]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Contract text copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 1500);
  };

  const highlightMatches = (content: string, query: string) => {
    if (!query.trim()) return content;
    const parts = content.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-legal-teal/30 text-white rounded px-0.5 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="flex flex-col w-full max-w-4xl h-[85vh] rounded-xl border border-white/10 bg-panel shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-legal-teal/15 text-legal-teal">
                  <FileText size={19} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">{title}</h3>
                  <p className="text-xs text-slate-400">Extracted Raw Text & Clause References</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition"
                >
                  {copied ? <Check size={14} className="text-legal-green" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy All'}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-3 border-b border-white/10 bg-white/[0.01]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search keywords inside contract (e.g. indemnity, liability, termination)..."
                  className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-6 text-sm leading-7 text-slate-300 font-mono whitespace-pre-wrap selection:bg-legal-teal/40">
              {loading ? (
                <div className="flex h-full items-center justify-center text-slate-400 gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-legal-teal border-t-transparent" />
                  <span>Loading full contract document...</span>
                </div>
              ) : (
                highlightMatches(text, search)
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
