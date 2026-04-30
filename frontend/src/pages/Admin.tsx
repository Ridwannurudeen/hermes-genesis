import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import {
  Activity,
  BarChart3,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { auth, type AuthStatus, type UsageEndpointRow, type UsageSnapshot } from '../api';

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'never';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statCells(usage: UsageSnapshot | null) {
  return [
    { label: 'requests', value: fmt(usage?.total_requests), icon: Activity },
    { label: 'failures', value: fmt(usage?.total_failures), icon: ShieldX },
    { label: 'model units', value: fmt(usage?.estimated_model_units), icon: BarChart3 },
    { label: 'updated', value: formatDate(usage?.updated_at), icon: RefreshCw },
  ];
}

function EndpointTable({ usage }: { usage: UsageSnapshot | null }) {
  const rows = useMemo(() => {
    const entries = Object.entries(usage?.by_endpoint ?? {}) as [string, UsageEndpointRow][];
    return entries.sort((a, b) => b[1].requests - a[1].requests).slice(0, 12);
  }, [usage]);

  if (!rows.length) {
    return (
      <div className="border border-subtle rounded-md px-4 py-8 text-center text-dim">
        No usage events recorded yet.
      </div>
    );
  }

  return (
    <div className="border border-subtle rounded-md overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_110px_90px] gap-px bg-slate-800/70 text-[11px] uppercase tracking-widest text-slate-500">
        <div className="bg-slate-950/80 px-3 py-2">endpoint</div>
        <div className="bg-slate-950/80 px-3 py-2 text-right">requests</div>
        <div className="bg-slate-950/80 px-3 py-2 text-right">failures</div>
        <div className="bg-slate-950/80 px-3 py-2 text-right">model units</div>
        <div className="bg-slate-950/80 px-3 py-2 text-right">avg ms</div>
      </div>
      {rows.map(([endpoint, row]) => (
        <div
          key={endpoint}
          className="grid grid-cols-[minmax(0,1fr)_90px_90px_110px_90px] gap-px bg-slate-800/50 text-sm"
        >
          <div className="bg-slate-950/45 px-3 py-2 font-mono text-slate-300 truncate">{endpoint}</div>
          <div className="bg-slate-950/45 px-3 py-2 text-right text-slate-200">{fmt(row.requests)}</div>
          <div className="bg-slate-950/45 px-3 py-2 text-right text-slate-200">{fmt(row.failures)}</div>
          <div className="bg-slate-950/45 px-3 py-2 text-right text-slate-200">
            {fmt(row.estimated_model_units)}
          </div>
          <div className="bg-slate-950/45 px-3 py-2 text-right text-slate-400">
            {Math.round(row.avg_ms)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const nextStatus = await auth.status();
    setStatus(nextStatus);
    if (nextStatus.admin) {
      setUsage(await auth.usage());
    } else {
      setUsage(null);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function login(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.login(apiKey);
      setApiKey('');
      await load();
    } catch (err) {
      setError('Admin key rejected.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await auth.logout();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const cells = statCells(usage);
  const admin = status?.admin === true;

  return (
    <main className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">internal</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">
            Admin
          </h1>
          <span className="eyebrow text-faint hidden sm:inline">
            {status?.auth_required ? (admin ? '· session active' : '· locked') : '· auth disabled'}
          </span>
          {admin && (
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading disabled:opacity-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              logout
            </button>
          )}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!admin ? (
          <form onSubmit={login} className="max-w-xl border border-subtle rounded-md p-5 bg-slate-950/45">
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2" htmlFor="admin-key">
              genesis api key
            </label>
            <div className="flex gap-2">
              <input
                id="admin-key"
                type="password"
                value={apiKey}
                onChange={(ev) => setApiKey(ev.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={busy || !apiKey}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                Login
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-800/60 border border-slate-800 rounded-md overflow-hidden">
              {cells.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-950/65 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold tracking-tight">{value}</div>
                      <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">{label}</div>
                    </div>
                    <Icon className="w-5 h-5 text-amber-400/80" />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h1 className="font-display text-xl font-semibold">Usage</h1>
                <button
                  type="button"
                  onClick={() => load().catch((err) => setError(err instanceof Error ? err.message : String(err)))}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-sm hover:bg-slate-800"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              <EndpointTable usage={usage} />
            </div>
          </>
        )}

        {error ? (
          <div className="border border-red-900/70 bg-red-950/30 text-red-200 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
