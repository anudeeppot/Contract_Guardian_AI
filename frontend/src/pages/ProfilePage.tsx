import { Building2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';

export function ProfilePage() {
  return (
    <div className="page-shell">
      <PageHeader eyebrow="Account" title="Profile" description="Manage reviewer identity, company context, and account security preferences." />
      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <GlassCard className="p-5">
          <div className="grid h-24 w-24 place-items-center rounded-lg bg-legal-gold/15 text-legal-gold"><UserRound size={42} /></div>
          <h2 className="mt-5 text-2xl font-semibold text-white">Jane Doe</h2>
          <p className="mt-1 text-sm text-slate-400">Senior Commercial Counsel</p>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <p className="flex items-center gap-2"><Mail size={16} className="text-legal-teal" />jane@company.com</p>
            <p className="flex items-center gap-2"><Building2 size={16} className="text-legal-teal" />Acme Legal Operations</p>
            <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-legal-teal" />Enterprise workspace</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="mb-5 text-lg font-semibold text-white">Profile details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" value="Jane Doe" />
            <Field label="Job title" value="Senior Commercial Counsel" />
            <Field label="Company" value="Acme Legal Operations" />
            <Field label="Email" value="jane@company.com" />
          </div>
          <button className="focus-ring mt-5 rounded-lg bg-legal-teal px-4 py-3 font-semibold text-ink">Save profile</button>
        </GlassCard>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input defaultValue={value} className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 text-white" />
    </label>
  );
}
