import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileSearch, Lock, Scale, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-legal-grid bg-[length:44px_44px]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-legal-gold/15 text-legal-gold">
            <Scale size={23} />
          </span>
          <span className="text-lg font-semibold text-white">Contract Guardian AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link className="text-sm text-slate-300 hover:text-white" to="/login">Login</Link>
          <Link className="focus-ring rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink" to="/register">Start</Link>
        </div>
      </nav>
      <section className="page-shell grid min-h-[calc(100vh-88px)] items-center gap-10 lg:grid-cols-[1.02fr_.98fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-legal-gold">AI legal contract analyzer</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
            Contract Guardian AI
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Upload PDFs or DOCX agreements, surface risky clauses, detect suspicious wording, and turn dense legal language into executive-ready guidance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/dashboard" className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-legal-teal px-5 py-3 font-semibold text-ink">
              Open dashboard <ArrowRight size={18} />
            </Link>
            <Link to="/upload" className="focus-ring inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/8 px-5 py-3 font-semibold text-white">
              Analyze contract
            </Link>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55 }} className="glass rounded-lg p-4">
          <div className="rounded-lg border border-white/10 bg-panel/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Vendor Agreement</p>
                <p className="text-2xl font-semibold text-white">Risk Score 78</p>
              </div>
              <span className="rounded-md border border-legal-red/30 bg-legal-red/10 px-3 py-1 text-sm font-semibold text-legal-red">High</span>
            </div>
            <div className="space-y-3">
              {[
                ['Hidden fees', 'Critical'],
                ['Automatic renewal', 'High'],
                ['One-sided liability', 'High'],
                ['Missing effective date', 'Medium'],
              ].map(([label, level]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] p-4">
                  <span className="flex items-center gap-3 text-sm text-slate-200"><ShieldCheck size={17} className="text-legal-teal" />{label}</span>
                  <span className="text-xs uppercase text-slate-400">{level}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Tile icon={<FileSearch size={18} />} label="42 clauses" />
              <Tile icon={<Lock size={18} />} label="6 alerts" />
              <Tile icon={<Scale size={18} />} label="91% confidence" />
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function Tile({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="rounded-lg bg-white/[0.055] p-3 text-center text-xs text-slate-300">{icon}<span className="mt-2 block">{label}</span></div>;
}
