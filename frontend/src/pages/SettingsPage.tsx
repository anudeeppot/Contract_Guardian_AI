import { useState, useEffect } from 'react';
import { Check, Moon, Palette, Server, ToggleLeft, ToggleRight } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { showToast } from '../components/ui/Toast';

export function SettingsPage() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('contract_guardian_dark_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [theme, setTheme] = useState<string>(() => {
    return window.localStorage.getItem('contract_guardian_theme') || 'Legal Glass';
  });
  const [apiUrl, setApiUrl] = useState(() => {
    return window.localStorage.getItem('contract_guardian_api_url') || API_BASE_URL;
  });

  const handleSave = () => {
    window.localStorage.setItem('contract_guardian_dark_mode', JSON.stringify(darkMode));
    window.localStorage.setItem('contract_guardian_theme', theme);
    window.localStorage.setItem('contract_guardian_api_url', apiUrl);
    showToast('Workspace settings saved successfully', 'success');
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Workspace Preferences"
        title="Settings & Configuration"
        description="Configure dashboard theme, API target endpoints, and local audit defaults."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="mb-4 text-base font-semibold text-white">Appearance & Display</h2>
          
          <button
            onClick={() => setDarkMode((value) => !value)}
            className="focus-ring flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.06] transition"
          >
            <span className="flex items-center gap-3">
              <Moon className="text-legal-gold" size={20} />
              <span>
                <span className="block text-sm font-semibold text-white">Dark Mode</span>
                <span className="text-xs text-slate-400">High-contrast, eye-strain reducing dark theme.</span>
              </span>
            </span>
            {darkMode ? (
              <ToggleRight className="text-legal-teal" size={28} />
            ) : (
              <ToggleLeft className="text-slate-500" size={28} />
            )}
          </button>

          <label className="mt-4 block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Palette size={14} className="text-legal-teal" /> Theme Palette
            </span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              className="focus-ring w-full rounded-lg border border-white/10 bg-panel px-4 py-3 text-xs text-white"
            >
              <option>Legal Glass (Default Teal & Gold)</option>
              <option>Executive Carbon (Monochrome & Emerald)</option>
              <option>Regulatory Blue (Cobalt & Silver)</option>
            </select>
          </label>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="mb-4 text-base font-semibold text-white">API Target Endpoint</h2>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <Server size={14} className="text-legal-teal" /> Backend Base URL
              </span>
              <input
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white"
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Default route points to local FastAPI backend (<code className="text-legal-teal">/api/v1</code>) running via Docker or direct development mode.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="focus-ring mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-legal-teal px-5 py-3 font-semibold text-ink hover:bg-legal-teal/90 transition text-xs"
          >
            <Check size={16} />
            Save Workspace Settings
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
