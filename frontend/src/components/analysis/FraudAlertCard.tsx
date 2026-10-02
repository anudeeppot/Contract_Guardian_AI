import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FraudAlert } from '../../types';
import { RiskBadge } from '../ui/RiskBadge';

export function FraudAlertCard({ alert }: { alert: FraudAlert }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-legal-red/25 bg-legal-red/10 p-4 shadow-danger">
      <button className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setOpen((value) => !value)}>
        <span className="flex gap-3">
          <span className="mt-0.5 grid h-10 w-10 place-items-center rounded-lg bg-legal-red/15 text-legal-red">
            <AlertTriangle size={20} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">{alert.title}</span>
            <span className="mt-1 block text-sm text-slate-300">{alert.why_detected}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <RiskBadge level={alert.risk_level} />
          <ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} size={18} />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-3">
              <Info title="Why detected" body={alert.why_detected} />
              <Info title="Business impact" body={alert.business_impact} />
              <Info title="Recommended action" body={alert.recommended_action} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-legal-gold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}
