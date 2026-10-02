import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  FileClock,
  FileSearch,
  Gauge,
  Scale,
  Settings,
  UploadCloud,
  User,
  LogOut,
  FileCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { logout } from '../../api/auth';
import { ToastContainer } from '../ui/Toast';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/upload', label: 'Upload & Audit', icon: UploadCloud },
  { to: '/analysis', label: 'Analysis & Clauses', icon: FileSearch },
  { to: '/report', label: 'Executive Report', icon: BarChart3 },
  { to: '/history', label: 'History & Compare', icon: FileClock },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string>('counsel@company.com');
  const [activeContractId, setActiveContractId] = useState<string | null>(null);

  useEffect(() => {
    // Read stored user info
    const storedUser = window.localStorage.getItem('contract_guardian_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) setUserEmail(parsed.email);
      } catch {
        // ignore
      }
    }
    const contractId = window.localStorage.getItem('contract_guardian_last_contract');
    setActiveContractId(contractId);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-legal-grid bg-[length:44px_44px]">
      {/* Global Toast Notification Container */}
      <ToastContainer />

      {/* Sidebar Navigation */}
      <aside className="fixed inset-x-3 bottom-3 z-30 rounded-xl glass lg:inset-y-4 lg:left-4 lg:right-auto lg:w-72">
        {/* Brand */}
        <div className="hidden border-b border-white/10 p-5 lg:block">
          <NavLink to="/dashboard" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-legal-gold/15 text-legal-gold shadow-lg shadow-legal-gold/5">
              <Scale size={23} />
            </span>
            <div>
              <span className="block text-sm font-bold tracking-tight text-white">Contract Guardian AI</span>
              <span className="text-[11px] font-medium text-legal-teal">AI Legal Risk Intelligence</span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items */}
        <nav className="flex items-center justify-between gap-1 p-2 lg:block lg:p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'focus-ring group flex min-w-0 flex-1 items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition lg:mb-1.5 lg:justify-start',
                  isActive
                    ? 'bg-legal-teal/15 text-legal-teal font-semibold border border-legal-teal/30 shadow-md'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              <item.icon size={17} />
              <span className="hidden truncate lg:block">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout on Desktop */}
        <div className="hidden lg:block absolute bottom-3 inset-x-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02]">
            <div className="min-w-0 pr-2">
              <span className="block truncate text-xs font-medium text-white">{userEmail}</span>
              <span className="block text-[10px] text-slate-500">Commercial Counsel</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-legal-red/15 hover:text-legal-red transition"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pb-24 lg:pl-80 lg:pb-8">
        {/* Top Header Bar */}
        <header className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileCheck size={15} className="text-legal-teal" />
              <span>Workspace:</span>
              <span className="font-medium text-slate-200">
                {activeContractId ? `Contract [${activeContractId.slice(0, 8)}...]` : 'No Contract Selected'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-legal-green/10 border border-legal-green/20 px-2.5 py-0.5 text-[11px] font-medium text-legal-green">
                <span className="h-1.5 w-1.5 rounded-full bg-legal-green animate-pulse" />
                AI Guardian Active
              </span>

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="lg:hidden flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-legal-red"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
