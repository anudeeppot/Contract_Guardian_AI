import { FormEvent, InputHTMLAttributes, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { login, signup } from '../api/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Access your contract risk workspace.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input name="email" label="Email" type="email" placeholder="legal@company.com" required />
        <Input name="password" label="Password" type="password" placeholder="Minimum 10 characters" required />
        {error && <p className="rounded-lg border border-legal-red/30 bg-legal-red/10 p-3 text-sm text-legal-red">{error}</p>}
        <button disabled={loading} className="focus-ring w-full rounded-lg bg-legal-teal px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">New here? <Link className="text-legal-teal" to="/register">Create account</Link></p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await signup(String(form.get('fullName')), String(form.get('email')), String(form.get('password')));
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Create account" subtitle="Start reviewing contracts with AI guidance.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input name="fullName" label="Full name" type="text" placeholder="Jane Doe" required />
        <Input name="email" label="Email" type="email" placeholder="jane@company.com" required />
        <Input name="password" label="Password" type="password" placeholder="Minimum 10 characters" required />
        {error && <p className="rounded-lg border border-legal-red/30 bg-legal-red/10 p-3 text-sm text-legal-red">{error}</p>}
        <button disabled={loading} className="focus-ring w-full rounded-lg bg-legal-teal px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">Already registered? <Link className="text-legal-teal" to="/login">Login</Link></p>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="glass w-full max-w-md rounded-lg p-6">
        <Link to="/" className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-legal-gold/15 text-legal-gold"><Scale size={22} /></span>
          <span className="font-semibold text-white">Contract Guardian AI</span>
        </Link>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="mb-6 mt-2 text-sm text-slate-400">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.065] px-4 py-3 text-white placeholder:text-slate-600" {...props} />
    </label>
  );
}
